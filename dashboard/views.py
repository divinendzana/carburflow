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

    def destroy(self, request, *args, **kwargs):
        """Suppression réservée aux responsables (les lignes partent en CASCADE)."""
        from rest_framework import status
        from rest_framework.response import Response
        from dashboard.permissions import user_is_admin

        if not user_is_admin(request.user):
            return Response(
                {'detail': 'Seul un responsable peut supprimer un rapport.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


class LigneRapportViewSet(viewsets.ModelViewSet):
    queryset = LigneRapport.objects.all()
    serializer_class = LigneRapportSerializer


class SitesVolumeAPIView(APIView):
    """API dédiée à la page Sites : évolution du volume total par cuve principale."""

    def get(self, request):
        reports = calc.ordered_rapports()
        labels = [calc.format_rapport_label(report) for report in reports]

        cuves = list(CuvePrincipale.objects.order_by('id'))
        site_series = []
        site_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']

        for idx, cuve in enumerate(cuves):
            data = []
            for report in reports:
                lignes = [
                    line for line in LigneRapport.objects.filter(rapport=report).select_related('cuve_journaliere')
                    if line.cuve_principale_id == cuve.id
                    or (
                        line.cuve_journaliere_id
                        and line.cuve_journaliere
                        and line.cuve_journaliere.cuve_principale_id == cuve.id
                    )
                ]
                if not lignes:
                    data.append(None)
                else:
                    data.append(round(calc._site_volume_from_lines(lignes), 1))
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
        reports = calc.ordered_rapports()
        labels = [calc.format_rapport_label(report) for report in reports]

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
                    has_counter = False
                    report_counter = 0.0
                    for line in lines:
                        if line.compteur_horaire is not None:
                            report_counter = max(report_counter, float(line.compteur_horaire))
                            has_counter = True

                    if not has_counter:
                        delta = 0.0
                    elif previous_counter is None:
                        delta = 0.0
                        previous_counter = report_counter
                    else:
                        delta = max(0.0, report_counter - previous_counter)
                        previous_counter = report_counter

                    values.append(round(delta, 1))

                site_datasets.append({
                    'label': groupe.identifiant,
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
        reports = calc.ordered_rapports()
        labels = [calc.format_rapport_label(report) for report in reports]

        cuves = list(CuvePrincipale.objects.order_by('id'))
        site_colors = ['#0b3d7a', '#3b82f6', '#60a5fa', '#1d4ed8', '#0ea5e9']
        sites_series = []

        for idx, cuve in enumerate(cuves):
            data = []
            previous_volume = None
            for report in reports:
                lignes = [
                    line for line in LigneRapport.objects.filter(rapport=report).select_related('cuve_journaliere')
                    if line.cuve_principale_id == cuve.id
                    or (
                        line.cuve_journaliere_id
                        and line.cuve_journaliere
                        and line.cuve_journaliere.cuve_principale_id == cuve.id
                    )
                ]
                if not lignes:
                    data.append(None)
                    continue

                current_volume = calc._site_volume_from_lines(lignes)
                depotage_total = calc._site_depotage_from_lines(lignes)

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
        reports = calc.ordered_rapports()
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

        labels = [calc.format_rapport_label(report) for report in reports]
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
                if any((v or 0) > 0 for v in gb['hours_run']):
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
        return calc.format_rapport_label(report)

    def _mean(self, values):
        numeric = [float(v) for v in values if v is not None]
        return float(statistics.fmean(numeric)) if numeric else 0.0

    def _mean_positive(self, values):
        """Moyenne alignée sur la page Groupes : ignore None et les 0."""
        numeric = [float(v) for v in values if v is not None and float(v) > 0]
        return float(statistics.fmean(numeric)) if numeric else 0.0

    def _last_numeric(self, values, default=0.0):
        for value in reversed(values or []):
            if value is not None:
                return round(float(value), 1)
        return default

    def _numeric_values(self, values, *, positive_only=False):
        out = []
        for v in values or []:
            if v is None:
                continue
            num = float(v)
            if positive_only and num <= 0:
                continue
            out.append(num)
        return out

    def get(self, request):
        reports = calc.ordered_rapports()
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

            # Moyenne = périodes avec conso > 0 uniquement (comme page Groupes)
            avg_consumption = round(self._mean_positive(consumption_series), 1)
            latest_consumption = self._last_numeric(consumption_series)
            latest_volume = self._last_numeric(volume_series)

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
            # Moyennes significatives (> 0), alignées sur les métriques Groupes
            avg_consumption = round(self._mean_positive(consumption_series), 1)
            # Semaine N = dernière période du rapport (None → 0), pas le dernier numérique non-null
            latest_consumption = round(float(consumption_series[-1]), 1) if consumption_series and consumption_series[-1] is not None else 0.0
            avg_hours = round(self._mean_positive(hours_series), 1)
            latest_hours = round(float(hours_series[-1]), 1) if hours_series and hours_series[-1] is not None else 0.0

            numeric_consumption = self._numeric_values(consumption_series, positive_only=True)
            variance_pct = 0.0
            if avg_consumption > 0 and len(numeric_consumption) > 1:
                variance_pct = round((statistics.pstdev(numeric_consumption) / avg_consumption) * 100, 1)

            # Écart semaine N = conso horaire uniquement (pas de fallback volume)
            ecart_pct = 0.0
            latest_hourly = block.get('latest_hourly_consumption')
            mean_deduite = float(block.get('mean_hourly_consumption_deduite') or 0.0)
            if (
                latest_hours > 0
                and latest_consumption > 0
                and latest_hourly is not None
                and mean_deduite > 0
            ):
                ecart_pct = abs((float(latest_hourly) - mean_deduite) / mean_deduite) * 100

            is_abnormal = ecart_pct > self.ABNORMAL_VARIANCE_THRESHOLD
            # Semaine N : conso > 0 et pas de delta horaire (0 ou absent)
            cons_sans_delta_n = latest_consumption > 0 and not (latest_hours > 0)
            cons_sans_delta = cons_sans_delta_n or bool(block.get('is_infinite_consumption'))
            has_anomaly = bool(is_abnormal or cons_sans_delta)

            group_rows.append({
                'id': block['id'],
                'label': block['label'],
                'site_id': block['site_id'],
                'site_name': block['site_nom'],
                'avg_consumption': avg_consumption,
                'latest_consumption': latest_consumption,
                'avg_hours': avg_hours,
                'latest_hours': latest_hours,
                'variance_pct': round(max(variance_pct, ecart_pct), 1),
                'ecart_pct': round(ecart_pct, 1),
                'autonomy': block['autonomie_hours'],
                'autonomie_hours': block['autonomie_hours'],
                'formatted_autonomy': block['formatted_autonomy'],
                'is_infinite_consumption': bool(block.get('is_infinite_consumption') or cons_sans_delta),
                'is_infinite_autonomy': block['is_infinite_autonomy'],
                'latest_main_volume': block['latest_main_volume'],
                'mean_hourly_consumption': block['mean_hourly_consumption'],
                'mean_hourly_consumption_deduite': block['mean_hourly_consumption_deduite'],
                'latest_hourly_consumption': block['latest_hourly_consumption'],
                'is_abnormal': is_abnormal,
                'has_anomaly': has_anomaly,
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
                    autonomy_text = f"Temps restant : {site['formatted_autonomy']}"
                else:
                    autonomy_text = f"Temps restant : {site['autonomy']} périodes"
                alerts.append({
                    'id': f"site-{site['id']}",
                    'type': 'site_autonomy',
                    'target': 'site',
                    'priority': 'Critique',
                    'priority_level': 'urgent',
                    'site_id': site['id'],
                    'site_name': site['site_name'],
                    'title': f"Site {site['site_name']} : temps restant critique",
                    'subtitle': f"{autonomy_text} — consommation moyenne {site['avg_consumption']:.1f} L.",
                })

        for group in group_rows:
            if not group['is_abnormal']:
                continue
            variance = group.get('ecart_pct') or group['variance_pct']
            sign = "▲" if (
                (group.get('latest_hourly_consumption') or 0)
                >= (group.get('mean_hourly_consumption_deduite') or 0)
            ) else "▼"
            alerts.append({
                'id': f"group-{group['id']}",
                'type': 'group_variance',
                'target': 'groups',
                'priority': 'Moyenne',
                'priority_level': 'warning',
                'group_id': group['id'],
                'group_label': group['label'],
                'site_name': group['site_name'],
                'ecart_pct': variance,
                'title': f"Groupe {group['label']} : écart de consommation horaire",
                'subtitle': (
                    f"Écart de {sign}{abs(variance):.1f}% entre la consommation horaire moyenne "
                    f"({group['mean_hourly_consumption_deduite']:.2f} L/h) et la consommation horaire semaine N "
                    f"({(group['latest_hourly_consumption'] if group['latest_hourly_consumption'] is not None else group['mean_hourly_consumption']):.2f} L/h). "
                    f"Consommation moyenne du groupe : {group['avg_consumption']:.1f} L."
                ),
            })

        priority_order = {'urgent': 0, 'warning': 1}
        alerts.sort(key=lambda item: (
            priority_order.get(item['priority_level'], 99),
            -(item.get('ecart_pct') or 0),
        ))

        prev_consumption = None
        prev_runtime = None
        if any(len(block['consumption']) >= 2 for block in group_blocks):
            prev_vals = [
                block['consumption'][-2]
                for block in group_blocks
                if len(block['consumption']) >= 2 and block['consumption'][-2] is not None
            ]
            prev_consumption = round(sum(prev_vals), 1) if prev_vals else None
        if any(len(block['hours_run']) >= 2 for block in group_blocks):
            prev_hrs = [
                block['hours_run'][-2]
                for block in group_blocks
                if len(block['hours_run']) >= 2 and block['hours_run'][-2] is not None
            ]
            prev_runtime = round(sum(prev_hrs), 1) if prev_hrs else None

        return Response({
            'reports': [{'id': r.id, 'label': self._report_label(r)} for r in reports],
            'summary': {
                'critical_autonomy_sites': sum(1 for s in site_rows if _site_is_critical(s)),
                'abnormal_consumption_groups': sum(
                    1 for g in group_rows if g.get('has_anomaly') or g.get('is_abnormal') or g.get('is_infinite_consumption')
                ),
                'total_consumption': round(sum(s['latest_consumption'] for s in site_rows), 1),
                'previous_total_consumption': prev_consumption,
                'total_runtime': round(sum(g['latest_hours'] for g in group_rows), 1),
                'previous_total_runtime': prev_runtime,
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
        reports = calc.ordered_rapports()
        labels = [calc.format_rapport_label(report) for report in reports]

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
                {'id': report.id, 'label': calc.format_rapport_label(report)}
                for report in reports
            ],
            'selected_rapport_debut': reports[0].id if reports else None,
            'selected_rapport_fin': reports[-1].id if reports else None,
            'selected_site_id': selected_site_id,
        })


class CuvesDashboardAPIView(APIView):
    """API page Cuves — adaptée au modèle post-refonte (site = cuve principale)."""

    def get(self, request):
        reports = calc.ordered_rapports()
        labels = [
            calc.format_rapport_label(report)
            for report in reports
        ]
        report_ids = [report.id for report in reports]
        sites = list(CuvePrincipale.objects.prefetch_related('cuves_journaliere').order_by('id'))

        selected_site_id = request.query_params.get('site_id')
        try:
            selected_site_id = int(selected_site_id) if selected_site_id not in (None, '') else None
        except (TypeError, ValueError):
            selected_site_id = None

        # Aucun site → toutes les cuves ; sinon filtre site.
        selected_sites = (
            [site for site in sites if site.id == selected_site_id]
            if selected_site_id is not None
            else list(sites)
        )

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

        principal_tanks = [
            site for site in selected_sites if (site.capacite or 0) > 0
        ]
        for index, cp in enumerate(principal_tanks):
            values = [series[0].get(cp.id, 0.0) for series in report_series]
            principal_blocks.append({
                'id': cp.id,
                'label': f"CP #{cp.id} ({cp.identifiant})",
                'site_id': cp.id,
                'site_label': cp.identifiant,
                'capacity': cp.capacite,
                'color': GROUPE_COLORS[index % len(GROUPE_COLORS)],
                'stats': _period_stats(values, start_idx, end_idx),
                'values': [round(v, 1) for v in values],
            })

        journalier_index = 0
        for site in selected_sites:
            for cj in site.cuves_journaliere.all():
                if (cj.capacite or 0) <= 0:
                    continue
                values = [series[1].get(cj.id, 0.0) for series in report_series]
                journalier_blocks.append({
                    'id': cj.id,
                    'label': f"CJ #{cj.id} ({site.identifiant})",
                    'site_id': site.id,
                    'site_label': site.identifiant,
                    'capacity': cj.capacite,
                    'color': GROUPE_COLORS[journalier_index % len(GROUPE_COLORS)],
                    'stats': _period_stats(values, start_idx, end_idx),
                    'values': [round(v, 1) for v in values],
                })
                journalier_index += 1

        journalier_tanks = [
            cj
            for site in selected_sites
            for cj in site.cuves_journaliere.all()
            if (cj.capacite or 0) > 0
        ]

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
                    'label': calc.format_rapport_label(report),
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