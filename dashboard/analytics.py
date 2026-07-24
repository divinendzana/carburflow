"""Calculs analytiques partagés pour les dashboards CarburFlow."""

from __future__ import annotations

import json

from dashboard.models import Site, Rapport, LigneRapport, CuvePrincipale, CuveJournaliere


GROUPE_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14']
SITE_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1']


def _variation_pct(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


def _stddev(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return round(variance ** 0.5, 1)


def _empty_window_stats() -> dict:
    return {
        'total': 0.0,
        'mean': 0.0,
        'previous_total': None,
        'previous_mean': None,
        'variation_pct': None,
        'mean_variation_pct': None,
        'all_time_mean': 0.0,
        'all_time_stddev': 0.0,
        'has_previous_period': False,
    }


def _previous_window_indices(start_idx: int, end_idx: int) -> tuple[int, int] | None:
    """Retourne (prev_start, prev_end) : fenêtre précédente de même longueur, ou None."""
    window_len = end_idx - start_idx + 1
    prev_end_idx = start_idx - 1
    prev_start_idx = prev_end_idx - window_len + 1
    if prev_start_idx < 0:
        return None
    return prev_start_idx, prev_end_idx


def _period_stats(values: list[float], start_idx: int, end_idx: int) -> dict:
    """Statistiques sur la fenêtre choisie, comparées à la période précédente de même durée."""
    window = values[start_idx:end_idx + 1]
    if not window:
        return _empty_window_stats()

    total = sum(window)
    window_nonzero = [v for v in window if v > 0]
    mean = sum(window_nonzero) / len(window_nonzero) if window_nonzero else 0.0

    meaningful = [v for v in values if v > 0]
    all_time_mean = sum(meaningful) / len(meaningful) if meaningful else 0.0
    all_time_stddev = _stddev(meaningful)

    prev_indices = _previous_window_indices(start_idx, end_idx)
    if prev_indices is None:
        return {
            'total': round(total, 1),
            'mean': round(mean, 1),
            'previous_total': None,
            'previous_mean': None,
            'variation_pct': None,
            'mean_variation_pct': None,
            'all_time_mean': round(all_time_mean, 1),
            'all_time_stddev': all_time_stddev,
            'has_previous_period': False,
        }

    prev_start, prev_end = prev_indices
    prev_window = values[prev_start:prev_end + 1]
    prev_window_nonzero = [v for v in prev_window if v > 0]
    prev_total = sum(prev_window)
    prev_mean = sum(prev_window_nonzero) / len(prev_window_nonzero) if prev_window_nonzero else 0.0

    return {
        'total': round(total, 1),
        'mean': round(mean, 1),
        'previous_total': round(prev_total, 1),
        'previous_mean': round(prev_mean, 1),
        'variation_pct': _variation_pct(total, prev_total),
        'mean_variation_pct': _variation_pct(mean, prev_mean),
        'all_time_mean': round(all_time_mean, 1),
        'all_time_stddev': all_time_stddev,
        'has_previous_period': True,
    }


def _previous_period_label(labels: list[str], start_idx: int, end_idx: int) -> str | None:
    prev_indices = _previous_window_indices(start_idx, end_idx)
    if prev_indices is None:
        return None
    prev_start, prev_end = prev_indices
    return f"{labels[prev_start]} → {labels[prev_end]}"


def _stock_change_consumption(previous_stock: float, current_stock: float, depotage: float) -> float:
    """Consommation sur une période : stock initial + dépôts - stock final."""
    consumption = previous_stock + depotage - current_stock
    return round(max(0.0, consumption), 1)


def build_groupe_timeseries():
    """Construit les séries temporelles horaires et consommation par groupe/site."""
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    labels = [
        f"{r.date_debut.strftime('%d/%m/%Y')} → {r.date_fin.strftime('%d/%m/%Y')}"
        for r in reports
    ]
    report_ids = [r.id for r in reports]

    sites = list(Site.objects.prefetch_related(
        'cuves_principales__cuves_journalieres__groupes_electrogenes'
    ).all())

    groupe_meta = {}
    groupe_to_site = {}
    site_groupes = {}

    group_cj_ids: dict[int, set[int]] = {}
    group_cp_ids: dict[int, set[int]] = {}

    for site in sites:
        groupes_set = set()
        for cp in site.cuves_principales.all():
            for cj in cp.cuves_journalieres.all():
                for g in cj.groupes_electrogenes.all():
                    groupes_set.add(g)
                    groupe_to_site[g.id] = site.id
                    group_cj_ids.setdefault(g.id, set()).add(cj.id)
                    group_cp_ids.setdefault(g.id, set()).add(cp.id)
                    groupe_meta[g.id] = {
                        'id': g.id,
                        'label': f'G#{g.id} ({g.marque} {g.puissance})',
                        'marque': g.marque,
                        'puissance': g.puissance,
                        'rate': g.consommation_horaire,
                        'site_id': site.id,
                        'site_nom': site.nom_site,
                    }
        site_groupes[site.id] = sorted(groupes_set, key=lambda g: g.id)

    all_groupe_ids = list(groupe_meta.keys())
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

    n = len(reports)
    hours_run_global = [0.0] * n
    hours_run_by_groupe = {g_id: [0.0] * n for g_id in all_groupe_ids}
    consumption_global = [0.0] * n
    consumption_by_site = {s.id: [0.0] * n for s in sites}
    consumption_by_groupe = {g_id: [0.0] * n for g_id in all_groupe_ids}

    report_group_stock = {g_id: [0.0] * n for g_id in all_groupe_ids}
    report_group_depotage = {g_id: [0.0] * n for g_id in all_groupe_ids}
    report_site_stock = {s.id: [0.0] * n for s in sites}
    report_site_depotage = {s.id: [0.0] * n for s in sites}

    for idx, r in enumerate(reports):
        lignes = LigneRapport.objects.filter(rapport=r)
        for line in lignes:
            amount = line.quantite_gasoil_cuve_principale + line.quantite_gasoil_cuve_journaliere
            depotage = line.depotage

            if line.groupe_id and line.groupe_id in report_group_stock:
                report_group_stock[line.groupe_id][idx] += amount
                report_group_depotage[line.groupe_id][idx] += depotage

            site_id = None
            if line.groupe_id:
                site_id = groupe_to_site.get(line.groupe_id)
            if site_id is None and line.cuve_principale_id is not None:
                site_id = line.cuve_principale.site_id
            elif site_id is None and line.cuve_journaliere_id is not None:
                site_id = line.cuve_journaliere.cuve_principale.site_id

            if site_id is not None:
                report_site_stock[site_id][idx] += amount
                report_site_depotage[site_id][idx] += depotage

    for g_id in all_groupe_ids:
        compteurs = groupe_compteurs[g_id]
        rate = groupe_meta[g_id]['rate']
        site_id = groupe_to_site.get(g_id)
        for i in range(1, n):
            prev_val = compteurs[i - 1]
            if prev_val > 0:
                delta_h = max(0.0, compteurs[i] - prev_val)
                hours_run_by_groupe[g_id][i] = round(delta_h, 1)
                hours_run_global[i] += round(delta_h, 1)

            prev_stock = report_group_stock[g_id][i - 1]
            current_stock = report_group_stock[g_id][i]
            depotages = report_group_depotage[g_id][i]
            consumed = _stock_change_consumption(prev_stock, current_stock, depotages)
            consumption_by_groupe[g_id][i] = consumed
            consumption_global[i] += consumed
            if site_id:
                consumption_by_site[site_id][i] += consumed

    for site_id, site_series in list(consumption_by_site.items()):
        for i in range(1, n):
            prev_stock = report_site_stock[site_id][i - 1]
            current_stock = report_site_stock[site_id][i]
            depotages = report_site_depotage[site_id][i]
            consumed = _stock_change_consumption(prev_stock, current_stock, depotages)
            consumption_by_site[site_id][i] = consumed

    hours_run_global = [round(v, 1) for v in hours_run_global]
    consumption_global = [round(v, 1) for v in consumption_global]

    hours_run_by_site = {s.id: [0.0] * n for s in sites}
    for g_id, hours_series in hours_run_by_groupe.items():
        sid = groupe_to_site.get(g_id)
        if sid:
            for i, val in enumerate(hours_series):
                hours_run_by_site[sid][i] += val
    hours_run_by_site = {sid: [round(v, 1) for v in vals] for sid, vals in hours_run_by_site.items()}

    latest_cj_volumes: dict[int, float] = {}
    latest_cp_volumes: dict[int, float] = {}
    if reports:
        latest_report = reports[-1]
        latest_lignes = LigneRapport.objects.filter(rapport=latest_report)
        for l in latest_lignes:
            if l.cuve_journaliere_id:
                existing = latest_cj_volumes.get(l.cuve_journaliere_id, 0.0)
                latest_cj_volumes[l.cuve_journaliere_id] = max(existing, l.quantite_gasoil_cuve_journaliere)
            if l.cuve_principale_id:
                existing = latest_cp_volumes.get(l.cuve_principale_id, 0.0)
                latest_cp_volumes[l.cuve_principale_id] = max(existing, l.quantite_gasoil_cuve_principale)

    group_last_report_volume = {
        g_id: sum(latest_cj_volumes.get(cj_id, 0.0) for cj_id in cj_ids)
        for g_id, cj_ids in group_cj_ids.items()
    }

    group_last_report_cp_volume = {
        g_id: sum(latest_cp_volumes.get(cp_id, 0.0) for cp_id in cp_ids)
        for g_id, cp_ids in group_cp_ids.items()
    }

    cumulative_global = []
    for r in reports:
        lignes = LigneRapport.objects.filter(rapport=r)
        report_hours = {}
        for l in lignes:
            if l.groupe_id:
                existing = report_hours.get(l.groupe_id, 0.0)
                report_hours[l.groupe_id] = max(existing, l.compteur_horaire)
        cumulative_global.append(round(sum(report_hours.values()), 1))

    return {
        'reports': reports,
        'labels': labels,
        'report_ids': report_ids,
        'sites': sites,
        'site_groupes': site_groupes,
        'groupe_meta': groupe_meta,
        'groupe_compteurs': groupe_compteurs,
        'group_last_report_volume': group_last_report_volume,
        'group_last_report_cp_volume': group_last_report_cp_volume,
        'hours_run_global': hours_run_global,
        'hours_run_by_groupe': hours_run_by_groupe,
        'hours_run_by_site': hours_run_by_site,
        'consumption_global': consumption_global,
        'consumption_by_site': consumption_by_site,
        'consumption_by_groupe': consumption_by_groupe,
        'cumulative_global': cumulative_global,
    }


def resolve_period_indices(report_ids: list[int], debut_id=None, fin_id=None) -> tuple[int, int]:
    """Résout les indices de début/fin à partir des IDs de rapport."""
    if not report_ids:
        return 0, 0

    start_idx = 0
    end_idx = len(report_ids) - 1

    if debut_id is not None:
        try:
            debut_id = int(debut_id)
            if debut_id in report_ids:
                start_idx = report_ids.index(debut_id)
        except (ValueError, TypeError):
            pass

    if fin_id is not None:
        try:
            fin_id = int(fin_id)
            if fin_id in report_ids:
                end_idx = report_ids.index(fin_id)
        except (ValueError, TypeError):
            pass

    if start_idx > end_idx:
        start_idx, end_idx = end_idx, start_idx

    return start_idx, end_idx


def get_groupes_page_context(rapport_debut_id=None, rapport_fin_id=None, site_id=None) -> dict:
    """Contexte complet pour la page Groupes avec filtres période et site."""
    ts = build_groupe_timeseries()
    reports = ts['reports']
    labels = ts['labels']
    report_ids = ts['report_ids']
    sites = ts['sites']

    start_idx, end_idx = resolve_period_indices(report_ids, rapport_debut_id, rapport_fin_id)
    window_labels = labels[start_idx:end_idx + 1]

    if site_id is not None:
        try:
            site_id = int(site_id)
        except (ValueError, TypeError):
            site_id = sites[0].id if sites else None
    if not site_id and sites:
        site_id = sites[0].id

    site_by_id = {s.id: s for s in sites}
    selected_site = site_by_id.get(site_id)

    site_hours = ts['hours_run_by_site'].get(site_id, [0.0] * len(labels))
    site_consumption = ts['consumption_by_site'].get(site_id, [0.0] * len(labels))
    site_hours_stats = _period_stats(site_hours, start_idx, end_idx)
    site_consumption_stats = _period_stats(site_consumption, start_idx, end_idx)

    site_groupes = ts['site_groupes'].get(site_id, [])
    group_blocks = []
    for idx, g in enumerate(site_groupes):
        meta = ts['groupe_meta'][g.id]
        color = GROUPE_COLORS[idx % len(GROUPE_COLORS)]
        hours_run = ts['hours_run_by_groupe'][g.id]
        consumption = ts['consumption_by_groupe'][g.id]
        compteurs = ts['groupe_compteurs'][g.id]
        last_report_volume = ts['group_last_report_volume'].get(g.id, 0.0)
        last_cp_volume = ts['group_last_report_cp_volume'].get(g.id, 0.0)
        consumption_stats = _period_stats(consumption, start_idx, end_idx)
        avg_abs_consumption = consumption_stats['all_time_mean']

        if last_cp_volume <= 0:
            autonomie_hours = round(last_report_volume / avg_abs_consumption, 1) if avg_abs_consumption > 0 else None
        else:
            remaining_cp_volume = max(0.0, last_cp_volume - last_report_volume)
            total_consumption = consumption_stats['total']
            autonomie_cp = round(remaining_cp_volume / total_consumption, 1) if total_consumption > 0 else 0.0
            autonomie_cj = round(last_report_volume / avg_abs_consumption, 1) if avg_abs_consumption > 0 else 0.0
            autonomie_hours = round(autonomie_cp + autonomie_cj, 1)

        group_blocks.append({
            'id': g.id,
            'label': meta['label'],
            'marque': meta['marque'],
            'puissance': meta['puissance'],
            'rate': meta['rate'],
            'color': color,
            'hours_stats': _period_stats(hours_run, start_idx, end_idx),
            'consumption_stats': consumption_stats,
            'autonomie_hours': autonomie_hours,
            'compteurs_json': json.dumps([round(v, 1) for v in compteurs[start_idx:end_idx + 1]]),
            'hours_run_json': json.dumps([round(v, 1) for v in hours_run[start_idx:end_idx + 1]]),
            'consumption_json': json.dumps([round(v, 1) for v in consumption[start_idx:end_idx + 1]]),
        })

    rapport_choices = [
        {'id': r.id, 'label': labels[i]}
        for i, r in enumerate(reports)
    ]

    previous_period_label = _previous_period_label(labels, start_idx, end_idx)

    return {
        'rapport_choices': rapport_choices,
        'selected_rapport_debut': report_ids[start_idx],
        'selected_rapport_fin': report_ids[end_idx],
        'selected_site_id': site_id,
        'selected_site': selected_site,
        'sites': sites,
        'period_label': f"{window_labels[0]} → {window_labels[-1]}" if window_labels else '—',
        'previous_period_label': previous_period_label,
        'site_hours_stats': site_hours_stats,
        'site_consumption_stats': site_consumption_stats,
        'group_blocks': group_blocks,
        'chart_labels_json': json.dumps(window_labels),
    }


def get_cuves_page_context(rapport_debut_id=None, rapport_fin_id=None, site_id=None) -> dict:
    """Contexte complet pour la page Cuves avec filtres période et site."""
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    labels = [
        f"{r.date_debut.strftime('%d/%m/%Y')} → {r.date_fin.strftime('%d/%m/%Y')}"
        for r in reports
    ]
    report_ids = [r.id for r in reports]
    sites = list(Site.objects.prefetch_related('cuves_principales__cuves_journalieres').all())

    start_idx, end_idx = resolve_period_indices(report_ids, rapport_debut_id, rapport_fin_id)
    window_labels = labels[start_idx:end_idx + 1]

    if site_id is not None:
        try:
            site_id = int(site_id)
        except (ValueError, TypeError):
            site_id = sites[0].id if sites else None
    if not site_id and sites:
        site_id = sites[0].id

    site_by_id = {s.id: s for s in sites}
    selected_site = site_by_id.get(site_id)

    report_series = []
    for report in reports:
        lignes = list(LigneRapport.objects.filter(rapport=report).select_related('cuve_principale', 'cuve_journaliere'))
        principal_map = {
            ligne.cuve_principale_id: ligne.quantite_gasoil_cuve_principale
            for ligne in lignes
            if ligne.cuve_principale_id is not None
        }
        journaliere_map = {
            ligne.cuve_journaliere_id: ligne.quantite_gasoil_cuve_journaliere
            for ligne in lignes
            if ligne.cuve_journaliere_id is not None
        }
        report_series.append((principal_map, journaliere_map))

    principal_blocks = []
    journalier_blocks = []

    if selected_site:
        principal_tanks = [cp for cp in selected_site.cuves_principales.all() if (cp.capacite or 0) > 0]
        journalier_tanks = [cj for cp in principal_tanks for cj in cp.cuves_journalieres.all() if (cj.capacite or 0) > 0]

        for index, cp in enumerate(principal_tanks):
            values = [
                report_series[i][0].get(cp.id, 0.0)
                for i in range(len(report_series))
            ]
            principal_blocks.append({
                'id': cp.id,
                'label': f"CP #{cp.id} ({selected_site.nom_site})",
                'capacity': cp.capacite,
                'color': GROUPE_COLORS[index % len(GROUPE_COLORS)],
                'stats': _period_stats(values, start_idx, end_idx),
                'values_json': json.dumps([round(v, 1) for v in values[start_idx:end_idx + 1]]),
            })

        for index, cj in enumerate(journalier_tanks):
            values = [
                report_series[i][1].get(cj.id, 0.0)
                for i in range(len(report_series))
            ]
            journalier_blocks.append({
                'id': cj.id,
                'label': f"CJ #{cj.id} ({selected_site.nom_site})",
                'capacity': cj.capacite,
                'color': GROUPE_COLORS[index % len(GROUPE_COLORS)],
                'stats': _period_stats(values, start_idx, end_idx),
                'values_json': json.dumps([round(v, 1) for v in values[start_idx:end_idx + 1]]),
            })

    site_principal_values = []
    site_journalier_values = []
    if selected_site:
        principal_tanks = [cp for cp in selected_site.cuves_principales.all() if (cp.capacite or 0) > 0]
        journalier_tanks = [cj for cp in principal_tanks for cj in cp.cuves_journalieres.all() if (cj.capacite or 0) > 0]
        for principal_map, journaliere_map in report_series:
            site_principal_values.append(sum(principal_map.get(cp.id, 0.0) for cp in principal_tanks))
            site_journalier_values.append(sum(journaliere_map.get(cj.id, 0.0) for cj in journalier_tanks))

    rapport_choices = [
        {'id': r.id, 'label': labels[i]}
        for i, r in enumerate(reports)
    ]

    previous_period_label = _previous_period_label(labels, start_idx, end_idx)

    return {
        'rapport_choices': rapport_choices,
        'selected_rapport_debut': report_ids[start_idx],
        'selected_rapport_fin': report_ids[end_idx],
        'selected_site_id': site_id,
        'selected_site': selected_site,
        'sites': sites,
        'period_label': f"{window_labels[0]} → {window_labels[-1]}" if window_labels else '—',
        'previous_period_label': previous_period_label,
        'site_principal_stats': _period_stats(site_principal_values, start_idx, end_idx),
        'site_journalier_stats': _period_stats(site_journalier_values, start_idx, end_idx),
        'principal_blocks': principal_blocks,
        'journalier_blocks': journalier_blocks,
        'chart_labels_json': json.dumps(window_labels),
    }
