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


class DashboardOverviewAPIView(APIView):
    """API dédiée au dashboard : résumé, tableaux de classement et alertes métier."""

    def _report_label(self, report):
        return f"{report.date_debut.strftime('%d/%m')} au {report.date_fin.strftime('%d/%m')}"

    def _mean(self, values):
        if not values:
            return 0.0
        return sum(values) / len(values)

    def get(self, request):
        reports = list(Rapport.objects.order_by('date_debut', 'id'))
        sites = list(CuvePrincipale.objects.order_by('id'))
        groups = list(GroupeElectrogene.objects.order_by('id'))

        site_rows = []
        site_latest_volume_map = {}
        for site in sites:
            consumption_series = []
            volume_series = []
            previous_volume = None

            for report in reports:
                lines = LigneRapport.objects.filter(rapport=report)
                current_volume = 0.0
                depotage_total = 0.0

                for line in lines:
                    if line.cuve_principale_id == site.id:
                        current_volume += float(line.quantite_gasoil_cuve_principale or 0.0)
                        current_volume += float(line.quantite_gasoil_cuve_journaliere or 0.0)

                    if line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id == site.id:
                        current_volume += float(line.quantite_gasoil_cuve_journaliere or 0.0)

                    if line.cuve_principale_id == site.id or (
                        line.cuve_journaliere_id and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id == site.id
                    ):
                        depotage_total += float(line.depotage or 0.0)

                if previous_volume is None:
                    consumption_value = 0.0
                else:
                    consumption_value = max(0.0, previous_volume - current_volume + depotage_total)

                consumption_series.append(round(consumption_value, 1))
                volume_series.append(round(current_volume, 1))
                previous_volume = current_volume

            avg_consumption = round(self._mean(consumption_series), 1) if consumption_series else 0.0
            latest_consumption = round(consumption_series[-1], 1) if consumption_series else 0.0
            latest_volume = round(volume_series[-1], 1) if volume_series else 0.0
            autonomy = None
            if avg_consumption > 0:
                autonomy = round(latest_volume / avg_consumption, 1)

            site_rows.append({
                'id': site.id,
                'site_name': site.identifiant,
                'label': site.identifiant,
                'avg_consumption': avg_consumption,
                'latest_consumption': latest_consumption,
                'latest_volume': latest_volume,
                'autonomy': autonomy,
            })
            site_latest_volume_map[site.id] = latest_volume

        site_rows.sort(key=lambda item: item['avg_consumption'], reverse=True)

        group_site_map = {}
        for report in reports:
            for line in LigneRapport.objects.filter(rapport=report):
                if line.groupe_electrogene_id and line.cuve_principale_id:
                    group_site_map.setdefault(line.groupe_electrogene_id, {})
                    group_site_map[line.groupe_electrogene_id][line.cuve_principale_id] = (
                        group_site_map[line.groupe_electrogene_id].get(line.cuve_principale_id, 0) + 1
                    )

        group_rows = []
        for group in groups:
            primary_site_id = None
            counts = group_site_map.get(group.id, {})
            if counts:
                primary_site_id = max(counts.items(), key=lambda item: item[1])[0]

            hours_series = []
            consumption_series = []
            previous_counter = None

            for report in reports:
                lines = LigneRapport.objects.filter(rapport=report, groupe_electrogene=group)
                if primary_site_id is not None:
                    lines = lines.filter(cuve_principale_id=primary_site_id)

                report_counter = 0.0
                report_consumption = 0.0
                for line in lines:
                    if line.compteur_horaire is not None:
                        report_counter = max(report_counter, float(line.compteur_horaire))
                    report_consumption += float(line.depotage or 0.0)

                if previous_counter is None:
                    hour_delta = 0.0
                else:
                    hour_delta = max(0.0, report_counter - previous_counter)

                hours_series.append(round(hour_delta, 1))
                consumption_series.append(round(report_consumption, 1))
                previous_counter = report_counter

            avg_consumption = round(self._mean(consumption_series), 1) if consumption_series else 0.0
            latest_consumption = round(consumption_series[-1], 1) if consumption_series else 0.0
            latest_hours = round(hours_series[-1], 1) if hours_series else 0.0
            avg_hours = round(self._mean(hours_series), 1) if hours_series else 0.0
            variance_pct = 0.0
            if avg_consumption > 0 and len(consumption_series) > 1:
                variance_pct = round((statistics.pstdev(consumption_series) / avg_consumption) * 100, 1)

            autonomy = None
            if primary_site_id is not None:
                latest_site_volume = float(site_latest_volume_map.get(primary_site_id, 0.0) or 0.0)
                if avg_consumption > 0:
                    autonomy = round(latest_site_volume / avg_consumption, 1)

            group_rows.append({
                'id': group.id,
                'label': f"G#{group.id} ({group.marque} {group.puissance})",
                'site_id': primary_site_id,
                'site_name': next((site.identifiant for site in sites if site.id == primary_site_id), ''),
                'avg_consumption': avg_consumption,
                'latest_consumption': latest_consumption,
                'avg_hours': avg_hours,
                'latest_hours': latest_hours,
                'variance_pct': variance_pct,
                'autonomy': autonomy,
                'is_abnormal': False,
            })

        mean_group_consumption = self._mean([group['avg_consumption'] for group in group_rows]) if group_rows else 0.0
        for group in group_rows:
            group['is_abnormal'] = group['avg_consumption'] > 0 and group['avg_consumption'] > mean_group_consumption * 1.2 and group['variance_pct'] > 15

        group_rows.sort(key=lambda item: item['avg_consumption'], reverse=True)

        alerts = []
        for site in site_rows:
            if site['autonomy'] is not None and site['autonomy'] <= 2.0:
                alerts.append({
                    'id': f"site-{site['id']}",
                    'type': 'site_autonomy',
                    'target': 'site',
                    'priority': 'Critique',
                    'priority_level': 'urgent',
                    'site_id': site['id'],
                    'site_name': site['site_name'],
                    'report_id': reports[-1].id if reports else None,
                    'report_label': self._report_label(reports[-1]) if reports else None,
                    'title': f"Site {site['site_name']} : autonomie critique",
                    'subtitle': f"Autonomie estimée à {site['autonomy']} périodes avec une consommation moyenne de {site['avg_consumption']:.1f} L.",
                })

        for group in group_rows:
            if group['is_abnormal']:
                alerts.append({
                    'id': f"group-{group['id']}",
                    'type': 'group_variance',
                    'target': 'groups',
                    'priority': 'Moyenne',
                    'priority_level': 'warning',
                    'group_id': group['id'],
                    'group_label': group['label'],
                    'site_name': group['site_name'],
                    'report_id': reports[-1].id if reports else None,
                    'report_label': self._report_label(reports[-1]) if reports else None,
                    'title': f"Groupe {group['label']} : consommation anormale",
                    'subtitle': f"Écart de {group['variance_pct']:.1f}% autour de la moyenne de consommation et {group['avg_consumption']:.1f} L en moyenne.",
                })

        alerts.sort(key=lambda item: (item['priority_level'] != 'urgent', -item['priority_level'].count('urgent')))

        return Response({
            'reports': [
                {'id': report.id, 'label': self._report_label(report)}
                for report in reports
            ],
            'summary': {
                'critical_autonomy_sites': sum(1 for site in site_rows if site['autonomy'] is not None and site['autonomy'] <= 2.0),
                'abnormal_consumption_groups': sum(1 for group in group_rows if group['is_abnormal']),
                'total_consumption': round(sum(site['latest_consumption'] for site in site_rows), 1),
                'total_runtime': round(sum(group['latest_hours'] for group in group_rows), 1),
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
        if selected_site_id not in (None, ''):
            selected_site_id = int(selected_site_id)
        else:
            selected_site_id = None

        group_site_map = {}
        for report in reports:
            for line in LigneRapport.objects.filter(rapport=report):
                if line.groupe_electrogene_id and line.cuve_principale_id:
                    group_site_map.setdefault(line.groupe_electrogene_id, {})
                    group_site_map[line.groupe_electrogene_id][line.cuve_principale_id] = (
                        group_site_map[line.groupe_electrogene_id].get(line.cuve_principale_id, 0) + 1
                    )

        group_primary_site_ids = {}
        for groupe in groupes:
            counts = group_site_map.get(groupe.id, {})
            if counts:
                group_primary_site_ids[groupe.id] = max(counts.items(), key=lambda item: item[1])[0]

        site_report_state = {}
        for site in sites:
            previous_site_volume = None
            for report in reports:
                lines = LigneRapport.objects.filter(rapport=report, cuve_principale=site)
                current_volume = 0.0
                depotage_total = 0.0
                for line in lines:
                    current_volume += float(line.quantite_gasoil_cuve_principale or 0.0)
                    current_volume += float(line.quantite_gasoil_cuve_journaliere or 0.0)
                    depotage_total += float(line.depotage or 0.0)

                if previous_site_volume is None:
                    delta = 0.0
                else:
                    delta = max(0.0, previous_site_volume - current_volume + depotage_total)

                site_report_state[(site.id, report.id)] = {
                    'current_volume': current_volume,
                    'delta': delta,
                }
                previous_site_volume = current_volume

        group_blocks = []
        for groupe in groupes:
            primary_site_id = group_primary_site_ids.get(groupe.id)
            if selected_site_id is not None and primary_site_id != selected_site_id:
                continue

            hours_run = []
            consumption = []
            volume = []
            previous_counter = None
            previous_volume = None

            for report in reports:
                lines = LigneRapport.objects.filter(rapport=report, groupe_electrogene=groupe)
                if primary_site_id is not None:
                    lines = lines.filter(cuve_principale_id=primary_site_id)

                report_counter = 0.0
                report_volume = 0.0
                report_consumption = 0.0
                report_hours = 0.0

                for line in lines:
                    if line.compteur_horaire is not None:
                        report_counter = max(report_counter, float(line.compteur_horaire))

                    if line.quantite_gasoil_cuve_principale is not None:
                        report_volume += float(line.quantite_gasoil_cuve_principale)
                    if line.quantite_gasoil_cuve_journaliere is not None:
                        report_volume += float(line.quantite_gasoil_cuve_journaliere)

                    if line.depotage is not None:
                        report_consumption += float(line.depotage)

                    if line.compteur_horaire is not None:
                        report_hours += float(line.compteur_horaire)

                if previous_counter is None:
                    hour_delta = 0.0
                else:
                    hour_delta = max(0.0, report_counter - previous_counter)

                hours_run.append(round(hour_delta, 1))
                previous_counter = report_counter

                site_state = site_report_state.get((primary_site_id, report.id), {}) if primary_site_id is not None else {}
                site_current_volume = float(site_state.get('current_volume', 0.0) or 0.0)
                site_delta = float(site_state.get('delta', 0.0) or 0.0)

                report_groups = []
                if primary_site_id is not None:
                    report_groups = list(
                        GroupeElectrogene.objects.filter(
                            lignes_rapport__rapport=report,
                            lignes_rapport__cuve_principale_id=primary_site_id,
                        ).distinct()
                    )

                total_power = sum(self._extract_power_value(group.puissance) for group in report_groups)
                group_share = 0.0
                if total_power > 0:
                    group_share = self._extract_power_value(groupe.puissance) / total_power
                elif report_groups:
                    group_share = 1.0 / len(report_groups)
                else:
                    group_share = 1.0

                weighted_report_volume = round(site_current_volume * group_share, 1)
                weighted_report_delta = round(site_delta * group_share, 1)

                if previous_volume is None:
                    volume_value = weighted_report_volume
                else:
                    volume_value = round(previous_volume + weighted_report_delta, 1)

                volume.append(volume_value)
                previous_volume = volume_value

                consumption.append(round(weighted_report_volume, 1))

            mean_hourly_consumption = 0.0
            if hours_run:
                positive_hours = [value for value in hours_run if value > 0]
                if positive_hours:
                    mean_hourly_consumption = sum(consumption) / sum(positive_hours) if sum(positive_hours) else 0.0

            main_tank_capacity = 0.0
            daily_tank_capacity = 0.0
            if primary_site_id is not None:
                main_tank = CuvePrincipale.objects.filter(id=primary_site_id).first()
                if main_tank:
                    main_tank_capacity = float(main_tank.capacite or 0.0)
                daily_tank = CuveJournaliere.objects.filter(cuve_principale_id=primary_site_id).order_by('id').first()
                if daily_tank:
                    daily_tank_capacity = float(daily_tank.capacite or 0.0)

            absolute_mean_consumption = 0.0
            if consumption:
                absolute_mean_consumption = sum(consumption) / len(consumption)

            autonomy_hours = 0.0
            if absolute_mean_consumption > 0:
                autonomy_hours += main_tank_capacity / absolute_mean_consumption
                if daily_tank_capacity > 0:
                    autonomy_hours += daily_tank_capacity / absolute_mean_consumption

            group_blocks.append({
                'id': groupe.id,
                'label': f"G#{groupe.id} ({groupe.marque} {groupe.puissance})",
                'site_id': primary_site_id,
                'site_nom': next((site.identifiant for site in sites if site.id == primary_site_id), ''),
                'hours_run': hours_run,
                'consumption': consumption,
                'volume': volume,
                'mean_hourly_consumption': round(mean_hourly_consumption, 3),
                'autonomie_hours': round(autonomy_hours, 1),
                'color': '#0b3d7a',
            })

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
