import json
from django.shortcuts import render
from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)
from dashboard.serializers import (
    SiteSerializer,
    CuvePrincipaleSerializer,
    CuveJournaliereSerializer,
    GroupeElectrogeneSerializer,
    RapportSerializer,
    LigneRapportSerializer,
)


def get_etat_cuves_context(selected_site_id=None):
    """
    Calcul de l'état des cuves d'après le dernier rapport.
    Transformé en graphiques visuels (Courbes/Barres) pour une lecture rapide et moderne.
    """
    latest_rapport = Rapport.objects.order_by('-date_fin', '-id').first()

    lignes_by_cp = {}
    lignes_by_cj = {}
    if latest_rapport:
        lignes = LigneRapport.objects.filter(rapport=latest_rapport)
        for ligne in lignes:
            if ligne.cuve_principale_id:
                lignes_by_cp[ligne.cuve_principale_id] = ligne.quantite_gasoil_cuve_principale
            if ligne.cuve_journaliere_id:
                lignes_by_cj[ligne.cuve_journaliere_id] = ligne.quantite_gasoil_cuve_journaliere

    sites = Site.objects.prefetch_related('cuves_principales__cuves_journalieres').all()

    sites_summary = []
    all_cp_rows = []
    total_volume_global = 0.0
    total_capacity_global = 0.0

    lowest_site_id = None
    lowest_site_pct = 999999.0

    for site in sites:
        cp_list = []
        site_cp_vol = 0.0
        site_cp_cap = 0.0

        for cp in site.cuves_principales.all():
            qty_cp = lignes_by_cp.get(cp.id, 0.0)
            cap_cp = cp.capacite
            pct_cp = round((qty_cp / cap_cp) * 100, 1) if cap_cp > 0 else 0.0
            pct_cp_clamped = min(100.0, max(0.0, pct_cp))

            if pct_cp >= 50:
                color_hex = '#198754'  # Vert
                badge_class = 'text-bg-success'
                status_label = 'Optimal'
            elif pct_cp >= 20:
                color_hex = '#ffc107'  # Jaune
                badge_class = 'text-bg-warning'
                status_label = 'Moyen'
            else:
                color_hex = '#dc3545'  # Rouge
                badge_class = 'text-bg-danger'
                status_label = 'Critique'

            cp_row = {
                'site': site,
                'cuve': cp,
                'label': f"CP #{cp.id} ({site.nom_site})",
                'capacite': cap_cp,
                'quantite': qty_cp,
                'pourcentage': pct_cp_clamped,
                'color_hex': color_hex,
                'badge_class': badge_class,
                'status_label': status_label,
            }
            cp_list.append(cp_row)
            all_cp_rows.append(cp_row)

            site_cp_vol += qty_cp
            site_cp_cap += cap_cp
            total_volume_global += qty_cp
            total_capacity_global += cap_cp

        cj_list = []
        for cp in site.cuves_principales.all():
            for cj in cp.cuves_journalieres.all():
                qty_cj = lignes_by_cj.get(cj.id, 0.0)
                cap_cj = cj.capacite
                pct_cj = round((qty_cj / cap_cj) * 100, 1) if cap_cj > 0 else 0.0
                pct_cj_clamped = min(100.0, max(0.0, pct_cj))

                if pct_cj >= 50:
                    cj_color_hex = '#198754'
                    cj_badge_class = 'text-bg-success'
                    cj_status_label = 'Optimal'
                elif pct_cj >= 20:
                    cj_color_hex = '#ffc107'
                    cj_badge_class = 'text-bg-warning'
                    cj_status_label = 'Moyen'
                else:
                    cj_color_hex = '#dc3545'
                    cj_badge_class = 'text-bg-danger'
                    cj_status_label = 'Critique'

                cj_list.append({
                    'cuve': cj,
                    'cuve_principale': cp,
                    'label': f"CJ #{cj.id}",
                    'capacite': cap_cj,
                    'quantite': qty_cj,
                    'pourcentage': pct_cj_clamped,
                    'color_hex': cj_color_hex,
                    'badge_class': cj_badge_class,
                    'status_label': cj_status_label,
                })
                total_volume_global += qty_cj
                total_capacity_global += cap_cj

        cj_list_sorted = sorted(cj_list, key=lambda x: x['pourcentage'])
        site_pct = round((site_cp_vol / site_cp_cap) * 100, 1) if site_cp_cap > 0 else 0.0
        if site_pct < lowest_site_pct:
            lowest_site_pct = site_pct
            lowest_site_id = site.id

        sites_summary.append({
            'site': site,
            'cuves_principales': sorted(cp_list, key=lambda x: x['pourcentage']),
            'cuves_journalieres': cj_list_sorted,
            'site_pct': site_pct,
        })

    all_cp_rows_sorted = sorted(all_cp_rows, key=lambda x: x['pourcentage'])

    active_site_id = None
    if selected_site_id is not None:
        try:
            active_site_id = int(selected_site_id)
        except (ValueError, TypeError):
            active_site_id = lowest_site_id
    if not active_site_id:
        active_site_id = lowest_site_id

    # Données JSON préparées pour les graphiques Chart.js de la Métrique 1
    cp_labels = [row['label'] for row in all_cp_rows_sorted]
    cp_pcts = [row['pourcentage'] for row in all_cp_rows_sorted]
    cp_colors = [row['color_hex'] for row in all_cp_rows_sorted]
    cp_quantities = [row['quantite'] for row in all_cp_rows_sorted]

    sites_cj_chart_data = {}
    for item in sites_summary:
        s_id = item['site'].id
        sites_cj_chart_data[s_id] = {
            'labels': [cj['label'] for cj in item['cuves_journalieres']],
            'percentages': [cj['pourcentage'] for cj in item['cuves_journalieres']],
            'quantities': [cj['quantite'] for cj in item['cuves_journalieres']],
            'colors': [cj['color_hex'] for cj in item['cuves_journalieres']],
        }

    global_pct = round((total_volume_global / total_capacity_global) * 100, 1) if total_capacity_global > 0 else 0.0

    return {
        'latest_rapport': latest_rapport,
        'all_cp_rows': all_cp_rows_sorted,
        'sites_summary': sites_summary,
        'active_site_id': active_site_id,
        'total_volume_global': total_volume_global,
        'total_capacity_global': total_capacity_global,
        'global_pct': global_pct,
        'cp_chart_labels_json': json.dumps(cp_labels),
        'cp_chart_pcts_json': json.dumps(cp_pcts),
        'cp_chart_colors_json': json.dumps(cp_colors),
        'cp_chart_quantities_json': json.dumps(cp_quantities),
        'sites_cj_chart_json': json.dumps(sites_cj_chart_data),
    }


def get_evolution_volumes_context():
    """Calcul des données de métrique #2 : Courbe d'évolution du volume total."""
    reports = Rapport.objects.order_by('date_debut', 'id')
    labels = [
        f"{r.date_debut.strftime('%d/%m')} au {r.date_fin.strftime('%d/%m')}"
        for r in reports
    ]

    sites = list(Site.objects.all())
    site_colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1']

    site_volumes = {s.id: [] for s in sites}
    global_volumes = []

    for r in reports:
        lignes = LigneRapport.objects.filter(rapport=r)
        r_total = 0.0
        for s in sites:
            site_lignes = lignes.filter(cuve_principale__site=s)
            cp_vol = site_lignes.aggregate(sum=Sum('quantite_gasoil_cuve_principale'))['sum'] or 0.0
            cj_vol = site_lignes.aggregate(sum=Sum('quantite_gasoil_cuve_journaliere'))['sum'] or 0.0
            tot = cp_vol + cj_vol
            site_volumes[s.id].append(tot)
            r_total += tot
        global_volumes.append(r_total)

    sites_series = []
    for idx, s in enumerate(sites):
        vols = site_volumes[s.id]
        last_vol = vols[-1] if vols else 0.0
        max_vol = max(vols) if vols else 0.0
        color = site_colors[idx % len(site_colors)]
        sites_series.append({
            'id': s.id,
            'nom_site': s.nom_site,
            'color': color,
            'data': vols,
            'last_volume': last_vol,
            'max_volume': max_vol,
        })

    sites_series_sorted = sorted(sites_series, key=lambda x: x['max_volume'], reverse=True)

    return {
        'chart_labels_json': json.dumps(labels),
        'global_series_json': json.dumps(global_volumes),
        'sites_series': sites_series_sorted,
        'sites_series_json': json.dumps([
            {
                'label': item['nom_site'],
                'data': item['data'],
                'borderColor': item['color'],
                'backgroundColor': item['color'] + '20',
                'borderWidth': 3,
                'tension': 0.35,
                'fill': False,
            }
            for item in sites_series_sorted
        ]),
    }


def get_horaires_groupes_context():
    """Calcul de la métrique #3 : Horaires de fonctionnement des groupes électrogènes.
    - Courbe globale : somme des compteurs horaires de tous les groupes par rapport.
    - Courbes par site filtrable : évolution du compteur horaire de chaque groupe du site.
    - Par défaut : le site ayant le plus gros cumul d'horaire.
    """
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    labels = [
        f"{r.date_debut.strftime('%d/%m')} au {r.date_fin.strftime('%d/%m')}"
        for r in reports
    ]

    sites = list(Site.objects.prefetch_related(
        'cuves_principales__cuves_journalieres__groupes_electrogenes'
    ).all())

    # Build mapping: site -> list of GroupeElectrogene objects
    site_groupes = {}
    groupe_to_site = {}
    for site in sites:
        groupes_set = set()
        for cp in site.cuves_principales.all():
            for cj in cp.cuves_journalieres.all():
                for g in cj.groupes_electrogenes.all():
                    groupes_set.add(g)
                    groupe_to_site[g.id] = site
        site_groupes[site.id] = sorted(groupes_set, key=lambda g: g.id)

    groupe_colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14']

    # Per-report data: global total hours & per-groupe hours
    global_hours = []
    groupe_hours = {}  # groupe_id -> [hours per report]
    all_groupe_ids = set()
    for g_id in groupe_to_site:
        all_groupe_ids.add(g_id)
        groupe_hours[g_id] = []

    for r in reports:
        lignes = LigneRapport.objects.filter(rapport=r)
        # Get max compteur_horaire per groupe in this report
        report_groupe_hours = {}
        for l in lignes:
            if l.groupe_id:
                existing = report_groupe_hours.get(l.groupe_id, 0.0)
                report_groupe_hours[l.groupe_id] = max(existing, l.compteur_horaire)

        r_total = sum(report_groupe_hours.values())
        global_hours.append(r_total)

        for g_id in all_groupe_ids:
            groupe_hours[g_id].append(report_groupe_hours.get(g_id, 0.0))

    # Build per-site chart datasets
    sites_horaires_data = {}
    site_max_hours = {}
    for site in sites:
        groupes = site_groupes.get(site.id, [])
        datasets = []
        site_total = 0.0
        for idx, g in enumerate(groupes):
            g_data = groupe_hours.get(g.id, [])
            color = groupe_colors[idx % len(groupe_colors)]
            last_val = g_data[-1] if g_data else 0.0
            site_total += last_val
            datasets.append({
                'label': f'G#{g.id} ({g.marque} {g.puissance})',
                'data': g_data,
                'borderColor': color,
                'backgroundColor': color + '20',
                'borderWidth': 3,
                'tension': 0.35,
                'fill': False,
                'pointRadius': 5,
                'pointHoverRadius': 7,
            })
        sites_horaires_data[site.id] = {
            'nom_site': site.nom_site,
            'datasets': datasets,
        }
        site_max_hours[site.id] = site_total

    # Default site = the one with the highest total hours
    default_site_id = max(site_max_hours, key=site_max_hours.get) if site_max_hours else (sites[0].id if sites else 1)

    # Latest report total hours
    latest_total = global_hours[-1] if global_hours else 0.0

    return {
        'horaires_labels_json': json.dumps(labels),
        'horaires_global_json': json.dumps(global_hours),
        'horaires_sites_data_json': json.dumps(sites_horaires_data),
        'horaires_default_site_id': default_site_id,
        'horaires_latest_total': latest_total,
        'horaires_sites_summary': [
            {
                'site': site,
                'total_hours': site_max_hours.get(site.id, 0.0),
                'groupes_count': len(site_groupes.get(site.id, [])),
            }
            for site in sorted(sites, key=lambda s: site_max_hours.get(s.id, 0.0), reverse=True)
        ],
    }


def get_consommation_context():
    """Calcul de la métrique #4 : Consommation totale de carburant.
    - Courbe globale : somme des consommations de tous les groupes par période de rapport.
    - Courbes par site : la courbe la plus haute correspond au site qui consomme le plus.
    Consommation = delta compteur horaire × consommation horaire (L/h) du groupe.
    """
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    labels = [
        f"{r.date_debut.strftime('%d/%m')} au {r.date_fin.strftime('%d/%m')}"
        for r in reports
    ]

    sites = list(Site.objects.prefetch_related(
        'cuves_principales__cuves_journalieres__groupes_electrogenes'
    ).all())

    groupe_to_site = {}
    groupe_rates = {}
    all_groupe_ids = set()
    for site in sites:
        for cp in site.cuves_principales.all():
            for cj in cp.cuves_journalieres.all():
                for g in cj.groupes_electrogenes.all():
                    all_groupe_ids.add(g.id)
                    groupe_to_site[g.id] = site.id
                    groupe_rates[g.id] = g.consommation_horaire

    # Compteur horaire par groupe et par rapport (forward-fill si absent)
    groupe_compteurs = {g_id: [] for g_id in all_groupe_ids}
    last_known = {g_id: 0.0 for g_id in all_groupe_ids}

    for r in reports:
        lignes = LigneRapport.objects.filter(rapport=r)
        report_compteurs = {}
        for l in lignes:
            if l.groupe_id:
                existing = report_compteurs.get(l.groupe_id, 0.0)
                report_compteurs[l.groupe_id] = max(existing, l.compteur_horaire)

        for g_id in all_groupe_ids:
            if g_id in report_compteurs and report_compteurs[g_id] > 0:
                last_known[g_id] = report_compteurs[g_id]
            groupe_compteurs[g_id].append(last_known[g_id])

    # Consommation par groupe puis agrégation par site
    site_consumption = {s.id: [0.0] * len(reports) for s in sites}
    global_consumption = [0.0] * len(reports)

    for g_id in all_groupe_ids:
        compteurs = groupe_compteurs[g_id]
        rate = groupe_rates.get(g_id, 0.0)
        site_id = groupe_to_site.get(g_id)
        for i in range(1, len(compteurs)):
            prev_val = compteurs[i - 1]
            if prev_val <= 0:
                continue
            delta_h = max(0.0, compteurs[i] - prev_val)
            consumed = round(delta_h * rate, 1)
            global_consumption[i] += consumed
            if site_id:
                site_consumption[site_id][i] += consumed

    site_colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1']
    sites_series = []
    for idx, s in enumerate(sites):
        data = [round(v, 1) for v in site_consumption[s.id]]
        total = round(sum(data), 1)
        max_val = max(data) if data else 0.0
        color = site_colors[idx % len(site_colors)]
        sites_series.append({
            'id': s.id,
            'nom_site': s.nom_site,
            'color': color,
            'data': data,
            'total_consumption': total,
            'max_consumption': max_val,
        })

    sites_series_sorted = sorted(sites_series, key=lambda x: x['max_consumption'], reverse=True)
    latest_total = round(global_consumption[-1], 1) if global_consumption else 0.0
    site_by_id = {s.id: s for s in sites}

    return {
        'consommation_labels_json': json.dumps(labels),
        'consommation_global_json': json.dumps([round(v, 1) for v in global_consumption]),
        'consommation_sites_series': sites_series_sorted,
        'consommation_sites_series_json': json.dumps([
            {
                'label': item['nom_site'],
                'data': item['data'],
                'borderColor': item['color'],
                'backgroundColor': item['color'] + '20',
                'borderWidth': 3,
                'tension': 0.35,
                'fill': False,
            }
            for item in sites_series_sorted
        ]),
        'consommation_latest_total': latest_total,
        'consommation_sites_summary': [
            {
                'site': site_by_id[item['id']],
                'total_consumption': item['total_consumption'],
                'max_consumption': item['max_consumption'],
            }
            for item in sites_series_sorted
        ],
    }


def dashboard_index_view(request):
    """Vue principale du Dashboard Général."""
    site_id = request.GET.get('site_id')
    context = get_etat_cuves_context(selected_site_id=site_id)
    context.update(get_evolution_volumes_context())
    context.update(get_horaires_groupes_context())
    context.update(get_consommation_context())
    return render(request, 'dashboard/index.html', context)


def etat_cuves_component_view(request):
    """Vue composant isolée pour la métrique 1."""
    site_id = request.GET.get('site_id')
    context = get_etat_cuves_context(selected_site_id=site_id)
    return render(request, 'dashboard/components/etat_cuves.html', context)


def evolution_volumes_component_view(request):
    """Vue composant isolée pour la métrique 2."""
    context = get_evolution_volumes_context()
    return render(request, 'dashboard/components/evolution_volumes.html', context)


def horaires_groupes_component_view(request):
    """Vue composant isolée pour la métrique 3 : Horaires de fonctionnement des groupes."""
    context = get_horaires_groupes_context()
    return render(request, 'dashboard/components/horaires_groupes.html', context)


def consommation_component_view(request):
    """Vue composant isolée pour la métrique 4 : Consommation totale de carburant."""
    context = get_consommation_context()
    return render(request, 'dashboard/components/consommation_carburant.html', context)


def groupes_dashboard_view(request):
    """Page dédiée aux groupes électrogènes avec filtres période et site."""
    from dashboard.analytics import get_groupes_page_context

    context = get_groupes_page_context(
        rapport_debut_id=request.GET.get('rapport_debut'),
        rapport_fin_id=request.GET.get('rapport_fin'),
        site_id=request.GET.get('site_id'),
    )
    return render(request, 'dashboard/groupes.html', context)


class EtatCuvesAPIView(APIView):
    """Endpoint API analytique pour la métrique 1."""

    @extend_schema(
        summary="État des cuves (Analytique)",
        description="Niveaux et pourcentages des cuves sous forme de séries analytiques.",
        responses={200: dict}
    )
    def get(self, request):
        site_id = request.query_params.get('site_id')
        context = get_etat_cuves_context(selected_site_id=site_id)
        latest_rapport = context['latest_rapport']

        return Response({
            'dernier_rapport': {
                'id_rapport': latest_rapport.id if latest_rapport else None,
                'date_debut': latest_rapport.date_debut if latest_rapport else None,
                'date_fin': latest_rapport.date_fin if latest_rapport else None,
            },
            'active_site_id': context['active_site_id'],
            'total_volume_global': context['total_volume_global'],
            'total_capacity_global': context['total_capacity_global'],
            'global_pct': context['global_pct'],
            'cp_chart_labels': json.loads(context['cp_chart_labels_json']),
            'cp_chart_pcts': json.loads(context['cp_chart_pcts_json']),
            'cp_chart_quantities': json.loads(context['cp_chart_quantities_json']),
            'sites_cj_chart_data': json.loads(context['sites_cj_chart_json']),
        })


class EvolutionVolumesAPIView(APIView):
    """Endpoint API analytique pour la métrique 2."""

    @extend_schema(
        summary="Évolution des volumes (Analytique)",
        description="Données chronologiques du volume total de carburant global et par site.",
        responses={200: dict}
    )
    def get(self, request):
        context = get_evolution_volumes_context()
        return Response({
            'labels': json.loads(context['chart_labels_json']),
            'global_volumes': json.loads(context['global_series_json']),
            'sites_series': json.loads(context['sites_series_json']),
        })


class HorairesGroupesAPIView(APIView):
    """Endpoint API analytique pour la métrique 3 : Horaires des groupes."""

    @extend_schema(
        summary="Horaires de fonctionnement des groupes (Analytique)",
        description="Évolution des compteurs horaires des groupes électrogènes global et par site.",
        responses={200: dict}
    )
    def get(self, request):
        context = get_horaires_groupes_context()
        return Response({
            'labels': json.loads(context['horaires_labels_json']),
            'global_hours': json.loads(context['horaires_global_json']),
            'default_site_id': context['horaires_default_site_id'],
            'latest_total_hours': context['horaires_latest_total'],
            'sites_data': json.loads(context['horaires_sites_data_json']),
        })


class ConsommationAPIView(APIView):
    """Endpoint API analytique pour la métrique 4 : Consommation de carburant."""

    @extend_schema(
        summary="Consommation de carburant (Analytique)",
        description="Consommation totale et par site calculée à partir des deltas horaires × L/h.",
        responses={200: dict}
    )
    def get(self, request):
        context = get_consommation_context()
        return Response({
            'labels': json.loads(context['consommation_labels_json']),
            'global_consumption': json.loads(context['consommation_global_json']),
            'latest_total_liters': context['consommation_latest_total'],
            'sites_series': json.loads(context['consommation_sites_series_json']),
        })


class GroupesDashboardAPIView(APIView):
    """Endpoint API analytique pour la page Groupes."""

    @extend_schema(
        summary="Dashboard Groupes (Analytique)",
        description="Métriques horaires et consommation avec filtres période et site.",
        responses={200: dict}
    )
    def get(self, request):
        from dashboard.analytics import get_groupes_page_context

        ctx = get_groupes_page_context(
            rapport_debut_id=request.query_params.get('rapport_debut'),
            rapport_fin_id=request.query_params.get('rapport_fin'),
            site_id=request.query_params.get('site_id'),
        )
        return Response({
            'period_label': ctx['period_label'],
            'selected_rapport_debut': ctx['selected_rapport_debut'],
            'selected_rapport_fin': ctx['selected_rapport_fin'],
            'selected_site_id': ctx['selected_site_id'],
            'previous_period_label': ctx['previous_period_label'],
            'site_hours': ctx['site_hours_stats'],
            'site_consumption': ctx['site_consumption_stats'],
            'labels': json.loads(ctx['chart_labels_json']),
            'group_blocks': [
                {
                    'id': b['id'],
                    'label': b['label'],
                    'hours': b['hours_stats'],
                    'consumption': json.loads(b['consumption_json']),
                    'compteurs': json.loads(b['compteurs_json']),
                    'hours_run': json.loads(b['hours_run_json']),
                }
                for b in ctx['group_blocks']
            ],
        })


# --- ViewSets REST Standard ---

class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer


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
