import json
import re
import statistics
from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from dashboard.models import (
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)
from dashboard.serializers import (
    CuvePrincipaleSerializer,
    CuveJournaliereSerializer,
    GroupeElectrogeneSerializer,
    RapportSerializer,
    LigneRapportSerializer,
)
from dashboard.utils import calculs as calc
from dashboard.analytics import GROUPE_COLORS, _period_stats

# --- ViewSets REST Standard ---

class CuvePrincipaleViewSet(viewsets.ModelViewSet):
    queryset = CuvePrincipale.objects.all()
    serializer_class = CuvePrincipaleSerializer


class CuveJournaliereViewSet(viewsets.ModelViewSet):
    queryset = CuveJournaliere.objects.all()
    serializer_class = CuveJournaliereSerializer


class GroupeElectrogeneViewSet(viewsets.ModelViewSet):
    queryset = GroupeElectrogene.objects.all()
    serializer_class = GroupeElectrogeneSerializer


class RapportViewSet(viewsets.ModelViewSet):
    queryset = Rapport.objects.all()
    serializer_class = RapportSerializer


class LigneRapportViewSet(viewsets.ModelViewSet):
    queryset = LigneRapport.objects.all()
    serializer_class = LigneRapportSerializer


class SitesVolumeAPIView(APIView):
    """API dédiée à la page Sites : évolution du volume total par cuve principale."""

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        labels = [f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}" for report in reports]

        cuves = list(CuvePrincipale.objects.order_by('id'))
        site_series = []
        site_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']

        for idx, cuve in enumerate(cuves):
            data = []
            for report in reports:
                lignes = LigneRapport.objects.filter(rapport=report)
                total = 0.0
                for line in lignes:
                    if line.cuve_principale_id == cuve.id:
                        total += float(line.quantite_gasoil_cuve_principale or 0.0)
                    if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id == cuve.id:
                        total += float(line.quantite_gasoil_cuve_journaliere or 0.0)
                data.append(round(total, 1))
            site_series.append({
                'id': cuve.id,
                'nom_site': cuve.identifiant,
                'label': cuve.identifiant,
                'data': data,
                'color': site_colors[idx % len(site_colors)],
            })

        return Response({
            'labels': labels,
            'sites_series': site_series,
        })


class SitesDureeAPIView(APIView):
    """API dédiée à la page Sites : durée de fonctionnement globale par cuve principale."""

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        labels = [f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}" for report in reports]

        cuves = list(CuvePrincipale.objects.order_by('id'))
        sites_data = {}
        group_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']

        for cuve in cuves:
            site_datasets = []
            groups = list(GroupeElectrogene.objects.all().order_by('id'))
            for group_idx, groupe in enumerate(groups):
                values = []
                previous_counter = None
                for report in reports:
                    lines = LigneRapport.objects.filter(rapport=report, cuve_principale=cuve, groupe_electrogene=groupe)
                    report_counter = 0.0
                    for line in lines:
                        if line.compteur_horaire is not None:
                            report_counter = max(report_counter, float(line.compteur_horaire))

                    if previous_counter is None:
                        delta = 0.0
                    else:
                        delta = max(0.0, report_counter - previous_counter)

                    values.append(round(delta, 1))
                    previous_counter = report_counter

                site_datasets.append({
                    'label': f"G#{groupe.id} ({groupe.marque} {groupe.puissance})",
                    'data': values,
                    'borderColor': group_colors[group_idx % len(group_colors)],
                    'backgroundColor': f"{group_colors[group_idx % len(group_colors)]}20",
                })
            sites_data[str(cuve.id)] = {
                'id': cuve.id,
                'nom_site': cuve.identifiant,
                'datasets': site_datasets,
            }

        default_site_id = cuves[0].id if cuves else None
        return Response({
            'labels': labels,
            'sites_data': sites_data,
            'default_site_id': default_site_id,
        })


class SitesConsommationAPIView(APIView):
    """API dédiée à la page Sites : consommation par cuve principale."""

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        labels = [f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}" for report in reports]

        cuves = list(CuvePrincipale.objects.order_by('id'))
        site_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']
        sites_series = []

        for idx, cuve in enumerate(cuves):
            data = []
            previous_volume = None
            for report in reports:
                lignes = LigneRapport.objects.filter(rapport=report)
                current_volume = 0.0
                depotage_total = 0.0

                for line in lignes:
                    if line.cuve_principale_id == cuve.id:
                        current_volume += float(line.quantite_gasoil_cuve_principale or 0.0)
                    if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id == cuve.id:
                        current_volume += float(line.quantite_gasoil_cuve_journaliere or 0.0)

                    if line.cuve_principale_id == cuve.id or (line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id == cuve.id):
                        depotage_total += float(line.depotage or 0.0)

                if previous_volume is None:
                    value = 0.0
                else:
                    value = max(0.0, previous_volume - current_volume + depotage_total)

                data.append(round(value, 1))
                previous_volume = current_volume

            sites_series.append({
                'id': cuve.id,
                'nom_site': cuve.identifiant,
                'label': cuve.identifiant,
                'data': data,
                'color': site_colors[idx % len(site_colors)],
            })

        return Response({
            'labels': labels,
            'sites_series': sites_series,
        })

class SitesDashboardAPIView(APIView):
    """API consolidée pour la page Sites : volume, durée et consommation - Version optimisée."""

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        sites = list(CuvePrincipale.objects.order_by('id'))
        groups = list(GroupeElectrogene.objects.order_by('id'))
        report_ids = [r.id for r in reports]

        # --- Une seule requête pour toutes les lignes (comme dans DashboardOverviewAPIView) ---
        lignes_all = list(
            LigneRapport.objects.filter(rapport_id__in=report_ids)
            .select_related('cuve_journaliere')
            .only(
                'rapport_id', 'groupe_electrogene_id', 'cuve_principale_id',
                'cuve_journaliere_id', 'cuve_journaliere__cuve_principale_id',
                'quantite_gasoil_cuve_principale', 'quantite_gasoil_cuve_journaliere',
                'depotage', 'compteur_horaire',
            )
        )

        labels = [f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}" for report in reports]
        site_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']
        group_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']

        # --- Indexation des lignes par (site_id, rapport_id) ---
        lines_by_site_report = {}
        for line in lignes_all:
            site_ids = set()
            if line.cuve_principale_id:
                site_ids.add(line.cuve_principale_id)
            if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id:
                site_ids.add(line.cuve_journaliere.cuve_principale_id)
            for sid in site_ids:
                lines_by_site_report.setdefault((sid, line.rapport_id), []).append(line)

        # --- Indexation identique à GroupesAPIView, pour réutiliser calc.calculer_groupes ---
        # (group_id, rapport_id) -> lignes du groupe, tous sites confondus
        lines_by_group_report = {}
        for line in lignes_all:
            if line.groupe_electrogene_id:
                lines_by_group_report.setdefault((line.groupe_electrogene_id, line.rapport_id), []).append(line)

        # groupe -> site principal (vote majoritaire)
        group_site_counts = {}
        for line in lignes_all:
            if line.groupe_electrogene_id and line.cuve_principale_id:
                counts = group_site_counts.setdefault(line.groupe_electrogene_id, {})
                counts[line.cuve_principale_id] = counts.get(line.cuve_principale_id, 0) + 1
        group_primary_site_ids = {
            gid: max(counts.items(), key=lambda item: item[1])[0]
            for gid, counts in group_site_counts.items()
        }

        # (site_id, rapport_id) -> ids des groupes actifs sur ce site à ce rapport
        groups_by_site_report = {}
        for line in lignes_all:
            if line.cuve_principale_id and line.groupe_electrogene_id:
                groups_by_site_report.setdefault((line.cuve_principale_id, line.rapport_id), set()).add(
                    line.groupe_electrogene_id
                )
        groupes_by_id = {g.id: g for g in groups}

        # volume/delta courant par (site, rapport) — nécessaire au partage par puissance
        site_report_state = calc.build_site_report_state(reports, sites, lines_by_site_report)

        # group_blocks calculés UNE FOIS avec l'algorithme de GroupesAPIView, réutilisés
        # pour construire hours_series et autonomy_by_site plus bas — c'est ce qui garantit
        # que les heures/consommation/autonomie par groupe sont identiques à la page Groupes.
        all_group_blocks = calc.calculer_groupes(
            reports=reports,
            groupes=groups,
            sites=sites,
            lines_by_group_report=lines_by_group_report,
            site_report_state=site_report_state,
            groups_by_site_report=groups_by_site_report,
            groupes_by_id=groupes_by_id,
            group_primary_site_ids=group_primary_site_ids,
        )
        group_blocks_by_site = {}
        for gb in all_group_blocks:
            if gb['site_id'] is not None:
                group_blocks_by_site.setdefault(gb['site_id'], []).append(gb)

        # --- Construction des séries ---
        volume_series = []
        consumption_series = []
        hours_series = []
        autonomy_by_site = {}

        for idx, site in enumerate(sites):
            site_id = site.id
            site_name = site.identifiant
            color = site_colors[idx % len(site_colors)]

            volume_data, consumption_data = calc.calculer_site_series(
                reports, lines_by_site_report, site_id
            )

            volume_series.append({
                'id': site_id,
                'nom_site': site_name,
                'label': site_name,
                'data': volume_data,
                'color': color,
            })

            consumption_series.append({
                'id': site_id,
                'nom_site': site_name,
                'label': site_name,
                'data': consumption_data,
                'color': color,
            })

            # --- Données de durée par groupe : reprises telles quelles depuis
            # all_group_blocks (algorithme GroupesAPIView), au lieu d'un recalcul
            # maison des heures par (site, groupe, rapport). ---
            site_datasets = []
            site_groups = group_blocks_by_site.get(site_id, [])
            for group_idx, gb in enumerate(site_groups):
                if any(v > 0 for v in gb['hours_run']):
                    site_datasets.append({
                        'label': gb['label'],
                        'data': gb['hours_run'],
                        'borderColor': group_colors[group_idx % len(group_colors)],
                        'backgroundColor': f"{group_colors[group_idx % len(group_colors)]}20",
                    })

            hours_series.append({
                'id': site_id,
                'nom_site': site_name,
                'datasets': site_datasets,
            })

            # --- Autonomie du site = max() des autonomies de ses groupes ---
            # Le site tient tant qu'au moins un groupe rattaché tient : on prend le
            # groupe le plus autonome (le plus sain), pas le plus critique. Un groupe
            # en is_infinite_consumption (0h, conso avérée sans heures) ne l'emporte
            # que si AUCUN groupe du site n'a d'autonomie finie — sinon un site avec un
            # groupe sain et un groupe à 0h serait à tort ramené à 0h alors qu'il tient
            # grâce à l'autre groupe.
            finite_hours = [g['autonomie_hours'] for g in site_groups if g['autonomie_hours'] is not None]
            if finite_hours:
                aut_hours = round(max(finite_hours), 1)
                fmt_aut = calc.formater_autonomie(aut_hours)
                has_infinite_cons, is_infinite_aut = False, False
            elif any(g['is_infinite_consumption'] for g in site_groups):
                aut_hours, fmt_aut = 0.0, "0h"
                has_infinite_cons, is_infinite_aut = True, False
            else:
                aut_hours, fmt_aut = None, "∞"
                has_infinite_cons, is_infinite_aut = False, True

            autonomy_by_site[str(site_id)] = {
                'autonomie_hours': aut_hours,
                'formatted_autonomy': fmt_aut,
                'is_infinite_consumption': has_infinite_cons,
                'is_infinite_autonomy': is_infinite_aut,
            }

        return Response({
            'labels': labels,
            'volumeSeries': volume_series,
            'hoursSeries': hours_series,
            'consumptionSeries': consumption_series,
            'autonomyBySite': autonomy_by_site,
            'defaultSiteId': sites[0].id if sites else None,
        })
        
class DashboardOverviewAPIView(APIView):
    """API dédiée au dashboard : résumé, tableaux de classement et alertes métier."""

    AUTONOMY_CRITICAL_THRESHOLD = 2.0
    AUTONOMY_CRITICAL_HOURS = 24.0
    ABNORMAL_CONSUMPTION_RATIO = 1.2
    ABNORMAL_VARIANCE_THRESHOLD = 15.0

    def _report_label(self, report):
        return f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}"

    def _mean(self, values):
        return sum(values) / len(values) if values else 0.0

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        sites = list(CuvePrincipale.objects.order_by('id'))
        groups = list(GroupeElectrogene.objects.order_by('id'))
        report_ids = [r.id for r in reports]

        # --- Une seule requête pour toutes les lignes ---
        lignes_all = list(
            LigneRapport.objects.filter(rapport_id__in=report_ids)
            .select_related('cuve_journaliere')
            .only(
                'rapport_id', 'groupe_electrogene_id', 'cuve_principale_id',
                'cuve_journaliere_id', 'cuve_journaliere__cuve_principale_id',
                'quantite_gasoil_cuve_principale', 'quantite_gasoil_cuve_journaliere',
                'depotage', 'compteur_horaire',
            )
        )

        # Indexation des lignes par (site_id, rapport_id)
        lines_by_site_report = {}
        for line in lignes_all:
            site_ids = set()
            if line.cuve_principale_id:
                site_ids.add(line.cuve_principale_id)
            if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id:
                site_ids.add(line.cuve_journaliere.cuve_principale_id)
            for sid in site_ids:
                lines_by_site_report.setdefault((sid, line.rapport_id), []).append(line)

        # --- Indexation identique à GroupesAPIView, pour réutiliser calc.calculer_groupes ---
        # (group_id, rapport_id) -> lignes du groupe, tous sites confondus
        lines_by_group_report = {}
        for line in lignes_all:
            if line.groupe_electrogene_id:
                lines_by_group_report.setdefault((line.groupe_electrogene_id, line.rapport_id), []).append(line)

        # --- Sites ---
        site_rows = []
        site_latest_volume_map = {}
        for site in sites:
            volume_series, consumption_series = calc.calculer_site_series(
                reports, lines_by_site_report, site.id
            )

            meaningful_consumption = consumption_series[1:] if len(consumption_series) > 1 else consumption_series
            avg_consumption = round(self._mean(meaningful_consumption), 1)
            latest_consumption = round(consumption_series[-1], 1) if consumption_series else 0.0
            latest_volume = round(volume_series[-1], 1) if volume_series else 0.0

            site_rows.append({
                'id': site.id,
                'site_name': site.identifiant,
                'label': site.identifiant,
                'avg_consumption': avg_consumption,
                'latest_consumption': latest_consumption,
                'latest_volume': latest_volume,
                'autonomy': None,
                'autonomie_hours': None,
                'formatted_autonomy': None,
                'is_infinite_consumption': False,
                'is_infinite_autonomy': False,
            })
            site_latest_volume_map[site.id] = latest_volume

        site_rows.sort(key=lambda item: item['avg_consumption'], reverse=True)

        # --- Groupes (avec calculs partagés) ---
        groups_by_site = {}
        group_site_counts = {}
        for line in lignes_all:
            if line.groupe_electrogene_id and line.cuve_principale_id:
                counts = group_site_counts.setdefault(line.groupe_electrogene_id, {})
                counts[line.cuve_principale_id] = counts.get(line.cuve_principale_id, 0) + 1
        group_primary_site_ids = {
            gid: max(counts.items(), key=lambda item: item[1])[0]
            for gid, counts in group_site_counts.items()
        }

        groups_by_site_report = {}
        for line in lignes_all:
            if line.cuve_principale_id and line.groupe_electrogene_id:
                groups_by_site_report.setdefault((line.cuve_principale_id, line.rapport_id), set()).add(
                    line.groupe_electrogene_id
                )
        groupes_by_id = {g.id: g for g in groups}

        site_report_state = calc.build_site_report_state(reports, sites, lines_by_site_report)

        group_blocks = calc.calculer_groupes(
            reports=reports,
            groupes=groups,
            sites=sites,
            lines_by_group_report=lines_by_group_report,
            site_report_state=site_report_state,
            groups_by_site_report=groups_by_site_report,
            groupes_by_id=groupes_by_id,
            group_primary_site_ids=group_primary_site_ids,
            selected_site_id=None,
        )

        # Conversion des group_blocks en group_rows
        group_rows = []
        for block in group_blocks:
            hours_series = block['hours_run']
            consumption_series = block['consumption']
            meaningful_consumption = consumption_series[1:] if len(consumption_series) > 1 else consumption_series
            meaningful_hours = hours_series[1:] if len(hours_series) > 1 else hours_series

            avg_consumption = round(self._mean(meaningful_consumption), 1)
            latest_consumption = round(consumption_series[-1], 1) if consumption_series else 0.0
            avg_hours = round(self._mean(meaningful_hours), 1)
            latest_hours = round(hours_series[-1], 1) if hours_series else 0.0

            variance_pct = 0.0
            if avg_consumption > 0 and len(meaningful_consumption) > 1:
                variance_pct = round((statistics.pstdev(meaningful_consumption) / avg_consumption) * 100, 1)

            is_abnormal = (
                avg_consumption > 0
                and block.get('mean_hourly_consumption_deduite', 0) > 0
                and block.get('mean_hourly_consumption', 0) > 0
                and block.get('mean_hourly_consumption_deduite', 0) > block.get('mean_hourly_consumption', 0) * 1.2
                and variance_pct > 15.0
            )

            group_rows.append({
                'id': block['id'],
                'label': block['label'],
                'site_id': block['site_id'],
                'site_name': block['site_nom'],
                'avg_consumption': avg_consumption,
                'latest_consumption': latest_consumption,
                'avg_hours': avg_hours,
                'latest_hours': latest_hours,
                'variance_pct': variance_pct,
                'autonomy': block['autonomie_hours'],
                'autonomie_hours': block['autonomie_hours'],
                'formatted_autonomy': block['formatted_autonomy'],
                'is_infinite_consumption': block['is_infinite_consumption'],
                'is_infinite_autonomy': block['is_infinite_autonomy'],
                'latest_main_volume': block['latest_main_volume'],
                'mean_hourly_consumption': block['mean_hourly_consumption'],
                'mean_hourly_consumption_deduite': block['mean_hourly_consumption_deduite'],
                'latest_hourly_consumption': block['latest_hourly_consumption'],
                'is_abnormal': is_abnormal,
            })

        # --- Autonomie de site ---
        groups_by_site = {}
        for g in group_rows:
            if g['site_id'] is not None:
                groups_by_site.setdefault(g['site_id'], []).append(g)

        site_rows_by_id = {s['id']: s for s in site_rows}
        for site_id, site_groups in groups_by_site.items():
            site = site_rows_by_id.get(site_id)
            if site is None:
                continue

            finite_hours = [g['autonomie_hours'] for g in site_groups if g['autonomie_hours'] is not None]
            if finite_hours:
                aut_hours = round(max(finite_hours), 1)
                site['autonomie_hours'] = aut_hours
                site['formatted_autonomy'] = calc.formater_autonomie(aut_hours)
                site['is_infinite_consumption'] = False
                site['is_infinite_autonomy'] = False
            elif any(g['is_infinite_consumption'] for g in site_groups):
                site['autonomie_hours'] = 0.0
                site['formatted_autonomy'] = '0h'
                site['is_infinite_consumption'] = True
                site['is_infinite_autonomy'] = False
            else:
                site['autonomie_hours'] = None
                site['formatted_autonomy'] = '∞'
                site['is_infinite_consumption'] = False
                site['is_infinite_autonomy'] = True

        # --- Alertes ---
        def _site_is_critical(site):
            if site['is_infinite_consumption']:
                return True
            if site['autonomie_hours'] is not None:
                return site['autonomie_hours'] <= self.AUTONOMY_CRITICAL_HOURS
            return site['autonomy'] is not None and site['autonomy'] <= self.AUTONOMY_CRITICAL_THRESHOLD

        alerts = []
        for site in site_rows:
            if _site_is_critical(site):
                if site['formatted_autonomy']:
                    autonomy_text = f"Autonomie estimée à {site['formatted_autonomy']}"
                else:
                    autonomy_text = f"Autonomie estimée à {site['autonomy']} périodes"
                alerts.append({
                    'id': f"site-{site['id']}",
                    'type': 'site_autonomy',
                    'target': 'site',
                    'priority': 'Critique',
                    'priority_level': 'urgent',
                    'site_id': site['id'],
                    'site_name': site['site_name'],
                    'title': f"Site {site['site_name']} : autonomie critique",
                    'subtitle': f"{autonomy_text} avec une consommation moyenne de {site['avg_consumption']:.1f} L.",
                })

        for group in group_rows:
            if group['is_abnormal']:
                variance = group['variance_pct']
                sign = "▲" if variance >= 0 else "▼"
                alerts.append({
                    'id': f"group-{group['id']}",
                    'type': 'group_variance',
                    'target': 'groups',
                    'priority': 'Moyenne',
                    'priority_level': 'warning',
                    'group_id': group['id'],
                    'group_label': group['label'],
                    'site_name': group['site_name'],
                    'title': f"Groupe {group['label']} : consommation anormale",
                    'subtitle': (
                        f"Écart de {sign}{abs(variance):.1f}% entre la consommation horaire déduite "
                        f"({group['mean_hourly_consumption_deduite']:.2f} L/h) et la consommation horaire réelle "
                        f"({group['mean_hourly_consumption']:.2f} L/h). Consommation moyenne du groupe : "
                        f"{group['avg_consumption']:.1f} L."
                    ),
                })

        priority_order = {'urgent': 0, 'warning': 1}
        alerts.sort(key=lambda item: priority_order.get(item['priority_level'], 99))

        return Response({
            'reports': [{'id': r.id, 'label': self._report_label(r)} for r in reports],
            'summary': {
                'critical_autonomy_sites': sum(1 for s in site_rows if _site_is_critical(s)),
                'abnormal_consumption_groups': sum(1 for g in group_rows if g['is_abnormal']),
                'total_consumption': round(sum(s['latest_consumption'] for s in site_rows), 1),
                'total_runtime': round(sum(g['latest_hours'] for g in group_rows), 1),
            },
            'sites': site_rows,
            'groups': group_rows,
            'alerts': alerts,
        })


class GroupesAPIView(APIView):
    """API dédiée à la page Groupes : durée, consommation et volume dérivés des lignes de rapport."""

    def _extract_power_value(self, value):
        if value in (None, ''):
            return 0.0
        text = str(value).strip().replace(',', '.')
        match = re.search(r'(\d+(?:\.\d+)?)', text)
        return float(match.group(1)) if match else 0.0

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        labels = [f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}" for report in reports]

        groupes = list(GroupeElectrogene.objects.order_by('id'))
        sites = list(CuvePrincipale.objects.order_by('id'))
        site_choices = [{'id': site.id, 'nom_site': site.identifiant} for site in sites]

        selected_site_id = request.query_params.get('site_id')
        selected_site_id = int(selected_site_id) if selected_site_id not in (None, '') else None

        report_ids = [r.id for r in reports]

        # --- Bloc unique : charger TOUTES les lignes en une seule requête (élimine le N+1) ---
        lignes_all = list(
            LigneRapport.objects.filter(rapport_id__in=report_ids)
            .select_related('cuve_journaliere')
            .only(
                'rapport_id', 'groupe_electrogene_id', 'cuve_principale_id',
                'cuve_journaliere_id', 'cuve_journaliere__cuve_principale_id',
                'quantite_gasoil_cuve_principale', 'quantite_gasoil_cuve_journaliere',
                'depotage', 'compteur_horaire',
            )
        )

        # --- Construction de group_primary_site_ids ---
        group_site_map = {}
        for line in lignes_all:
            if line.groupe_electrogene_id and line.cuve_principale_id:
                counts = group_site_map.setdefault(line.groupe_electrogene_id, {})
                counts[line.cuve_principale_id] = counts.get(line.cuve_principale_id, 0) + 1

        group_primary_site_ids = {
            groupe.id: max(group_site_map[groupe.id].items(), key=lambda item: item[1])[0]
            for groupe in groupes
            if group_site_map.get(groupe.id)
        }

        # --- Indexation des lignes par (site_id, rapport_id) ---
        lines_by_site_report = {}
        for line in lignes_all:
            site_ids = set()
            if line.cuve_principale_id:
                site_ids.add(line.cuve_principale_id)
            if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id:
                site_ids.add(line.cuve_journaliere.cuve_principale_id)
            for sid in site_ids:
                lines_by_site_report.setdefault((sid, line.rapport_id), []).append(line)

        site_report_state = calc.build_site_report_state(reports, sites, lines_by_site_report)

        # (site_id, rapport_id) -> ids des groupes actifs sur ce site à ce rapport
        groups_by_site_report = {}
        for line in lignes_all:
            if line.cuve_principale_id and line.groupe_electrogene_id:
                groups_by_site_report.setdefault((line.cuve_principale_id, line.rapport_id), set()).add(
                    line.groupe_electrogene_id
                )
        groupes_by_id = {g.id: g for g in groupes}

        # --- Grouper les lignes par (groupe, rapport) ---
        lines_by_group_report = {}
        for line in lignes_all:
            if line.groupe_electrogene_id:
                lines_by_group_report.setdefault((line.groupe_electrogene_id, line.rapport_id), []).append(line)

        group_blocks = calc.calculer_groupes(
            reports=reports,
            groupes=groupes,
            sites=sites,
            lines_by_group_report=lines_by_group_report,
            site_report_state=site_report_state,
            groups_by_site_report=groups_by_site_report,
            groupes_by_id=groupes_by_id,
            group_primary_site_ids=group_primary_site_ids,
            selected_site_id=selected_site_id,
        )

        return Response({
            'labels': labels,
            'group_blocks': group_blocks,
            'sites': site_choices,
            'rapport_choices': [
                {'id': report.id, 'label': f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}"}
                for report in reports
            ],
            'selected_rapport_debut': reports[0].id if reports else None,
            'selected_rapport_fin': reports[-1].id if reports else None,
            'selected_site_id': selected_site_id,
        })


class CuvesDashboardAPIView(APIView):
    """API page Cuves — adaptée au modèle post-refonte (site = cuve principale)."""

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        labels = [
            f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}"
            for report in reports
        ]
        report_ids = [report.id for report in reports]
        sites = list(CuvePrincipale.objects.prefetch_related('cuves_journaliere').order_by('id'))

        selected_site_id = request.query_params.get('site_id')
        try:
            selected_site_id = int(selected_site_id) if selected_site_id not in (None, '') else None
        except (TypeError, ValueError):
            selected_site_id = None
        if selected_site_id is None and sites:
            selected_site_id = sites[0].id

        selected_site = next((site for site in sites if site.id == selected_site_id), None)

        debut_raw = request.query_params.get('rapport_debut')
        fin_raw = request.query_params.get('rapport_fin')
        try:
            debut_id = int(debut_raw) if debut_raw not in (None, '') else None
        except (TypeError, ValueError):
            debut_id = None
        try:
            fin_id = int(fin_raw) if fin_raw not in (None, '') else None
        except (TypeError, ValueError):
            fin_id = None

        start_idx = report_ids.index(debut_id) if debut_id in report_ids else 0
        end_idx = report_ids.index(fin_id) if fin_id in report_ids else max(len(report_ids) - 1, 0)
        if start_idx > end_idx:
            start_idx, end_idx = end_idx, start_idx

        lignes_all = list(
            LigneRapport.objects.filter(rapport_id__in=report_ids)
            .select_related('cuve_journaliere')
            .only(
                'rapport_id',
                'cuve_principale_id',
                'cuve_journaliere_id',
                'quantite_gasoil_cuve_principale',
                'quantite_gasoil_cuve_journaliere',
            )
        )

        report_series = []
        for report in reports:
            principal_map = {}
            journaliere_map = {}
            for line in lignes_all:
                if line.rapport_id != report.id:
                    continue
                if line.cuve_principale_id is not None:
                    principal_map[line.cuve_principale_id] = float(
                        line.quantite_gasoil_cuve_principale or 0.0
                    )
                if line.cuve_journaliere_id is not None:
                    journaliere_map[line.cuve_journaliere_id] = float(
                        line.quantite_gasoil_cuve_journaliere or 0.0
                    )
            report_series.append((principal_map, journaliere_map))

        principal_blocks = []
        journalier_blocks = []
        site_principal_values = []
        site_journalier_values = []

        if selected_site:
            principal_tanks = [selected_site] if (selected_site.capacite or 0) > 0 else []
            journalier_tanks = [
                cj for cj in selected_site.cuves_journaliere.all()
                if (cj.capacite or 0) > 0
            ]

            for index, cp in enumerate(principal_tanks):
                values = [series[0].get(cp.id, 0.0) for series in report_series]
                principal_blocks.append({
                    'id': cp.id,
                    'label': f"CP #{cp.id} ({selected_site.identifiant})",
                    'capacity': cp.capacite,
                    'color': GROUPE_COLORS[index % len(GROUPE_COLORS)],
                    'stats': _period_stats(values, start_idx, end_idx),
                    'values': [round(v, 1) for v in values],
                })

            for index, cj in enumerate(journalier_tanks):
                values = [series[1].get(cj.id, 0.0) for series in report_series]
                journalier_blocks.append({
                    'id': cj.id,
                    'label': f"CJ #{cj.id} ({selected_site.identifiant})",
                    'capacity': cj.capacite,
                    'color': GROUPE_COLORS[index % len(GROUPE_COLORS)],
                    'stats': _period_stats(values, start_idx, end_idx),
                    'values': [round(v, 1) for v in values],
                })

            for principal_map, journaliere_map in report_series:
                site_principal_values.append(
                    sum(principal_map.get(cp.id, 0.0) for cp in principal_tanks)
                )
                site_journalier_values.append(
                    sum(journaliere_map.get(cj.id, 0.0) for cj in journalier_tanks)
                )

        return Response({
            'labels': labels,
            'rapport_choices': [
                {
                    'id': report.id,
                    'label': f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}",
                }
                for report in reports
            ],
            'selected_rapport_debut': report_ids[start_idx] if report_ids else None,
            'selected_rapport_fin': report_ids[end_idx] if report_ids else None,
            'selected_site_id': selected_site_id,
            'sites': [{'id': site.id, 'nom_site': site.identifiant} for site in sites],
            'site_principal_stats': _period_stats(site_principal_values, start_idx, end_idx)
            if site_principal_values else _period_stats([], 0, 0),
            'site_journalier_stats': _period_stats(site_journalier_values, start_idx, end_idx)
            if site_journalier_values else _period_stats([], 0, 0),
            'principal_blocks': principal_blocks,
            'journalier_blocks': journalier_blocks,
        })