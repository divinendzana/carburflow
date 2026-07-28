"""Calculs analytiques partagés pour les dashboards CarburFlow."""

from __future__ import annotations

import datetime
import json
from typing import Any

from django.db.models import Count, F

from dashboard.models import CuvePrincipale, GroupeElectrogene, LigneRapport, Rapport
from dashboard.utils.calculs import (
    build_site_report_state,
    calculer_groupes,
    calculer_site_series,
    formater_autonomie,
    moyenne,
)


GROUPE_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14']
# Couleurs Bootstrap
SITE_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1']


def _variation_pct(current: float, previous: float) -> float | None:
    """Renvoie la variation en pourcentage entre deux valeurs.
    Si la valeur précédente est nulle, on évite la division par zéro en renvoyant
    100 % seulement si la valeur courante est non nulle, sinon None.
    """
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


def _stddev(values: list[float]) -> float:
    """Calcule l'écart type des valeurs fournies.
    On utilise la moyenne puis on mesure l'écart quadratique moyen.
    """
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return round(variance ** 0.5, 1)


def _empty_window_stats() -> dict:
    """Retourne une structure de statistiques vide pour une fenêtre sans données.
    Cela évite les valeurs nulles et permet d'afficher proprement un cas sans résultats.
    """
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
    """Retourne les indices de la fenêtre précédente de même longueur.
    On calcule la période antérieure en remontant d'autant d'éléments que la période
    sélectionnée. Si la période commence trop tôt, on renvoie None.
    """
    window_len = end_idx - start_idx + 1
    prev_end_idx = start_idx - 1
    prev_start_idx = prev_end_idx - window_len + 1
    if prev_start_idx < 0:
        return None
    return prev_start_idx, prev_end_idx


def _period_stats(values: list[float], start_idx: int, end_idx: int) -> dict:
    """Calcule les statistiques pour une période choisie et sa période précédente.
    On extrait la fenêtre demandée puis on compare au même nombre de valeurs
    juste avant cette fenêtre pour obtenir des variations et des moyennes.
    """
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
    """Retourne le libellé texte de la période précédente.
    On utilise la liste de labels de rapports pour construire une phrase simple
    du type "début → fin" pour la période antérieure.
    """
    prev_indices = _previous_window_indices(start_idx, end_idx)
    if prev_indices is None:
        return None
    prev_start, prev_end = prev_indices
    return f"{labels[prev_start]} → {labels[prev_end]}"


def _stock_change_consumption(previous_stock: float, current_stock: float, depotage: float) -> float:
    """Consommation sur une période : on utilise la formule stock initial + dépôts - stock final.
    Les dépôts sont considérés de façon algébrique, donc cette variante généralisée
    correspond à la formule de base étudiée en supervision de carburant.
    """
    consumption = previous_stock + depotage - current_stock
    return round(max(0.0, consumption), 1)


def resolve_period_indices(
    report_ids: list[int],
    debut_id: int | None = None,
    fin_id: int | None = None,
) -> tuple[int, int]:
    """Transforme des identifiants de rapports en indices de période.
    Si les IDs fournis ne sont pas valides, on revient à la période complète.
    """
    if not report_ids:
        return 0, 0

    start_idx, end_idx = 0, len(report_ids) - 1

    try:
        if debut_id is not None:
            start_idx = report_ids.index(int(debut_id))
    except (ValueError, TypeError):
        pass  # Garde 0

    try:
        if fin_id is not None:
            end_idx = report_ids.index(int(fin_id))
    except (ValueError, TypeError):
        pass  # Garde len - 1

    if start_idx > end_idx:
        start_idx, end_idx = end_idx, start_idx

    return start_idx, end_idx


def get_groupes_page_context(
    rapport_debut_id: int | None = None,
    rapport_fin_id: int | None = None,
    site_id: int | None = None,
) -> dict:
    """Prépare le contexte de données pour la page "Groupes"."""
    # 1. Récupérer les objets de base (rapports, sites, groupes)
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    sites = list(CuvePrincipale.objects.order_by('identifiant'))
    groupes = list(GroupeElectrogene.objects.order_by('id'))

    report_ids = [r.id for r in reports]
    report_labels = [r.date_debut.strftime('%d/%m') for r in reports]

    # 2. Pré-calculer les lookups pour optimiser les accès
    lines = LigneRapport.objects.select_related('cuve_principale', 'groupe_electrogene', 'cuve_journaliere').filter(
        rapport_id__in=report_ids
    )
    lines_by_group_report = {}
    lines_by_site_report = {}
    groups_by_site_report = {}
    for line in lines:
        if line.groupe_electrogene_id:
            key = (line.groupe_electrogene_id, line.rapport_id)
            lines_by_group_report.setdefault(key, []).append(line)
        
        site_id_for_line = line.cuve_principale_id
        if not site_id_for_line and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id:
            site_id_for_line = line.cuve_journaliere.cuve_principale_id

        if site_id_for_line:
            key = (site_id_for_line, line.rapport_id)
            lines_by_site_report.setdefault(key, []).append(line)
            if line.groupe_electrogene_id:
                groups_by_site_report.setdefault(key, set()).add(line.groupe_electrogene_id)

    groupes_by_id = {g.id: g for g in groupes}
    group_primary_site_ids = {
        g.id: g.cuve_journaliere.cuve_principale_id
        for g in GroupeElectrogene.objects.select_related('cuve_journaliere').filter(
            id__in=groupes_by_id.keys()
        )
        if g.cuve_journaliere_id and g.cuve_journaliere.cuve_principale_id
    }

    # 3. Calculer l'état de chaque site pour chaque rapport (consommation, volume)
    site_report_state = build_site_report_state(reports, sites, lines_by_site_report)

    # 4. Calculer les métriques complètes pour chaque groupe
    site_id_as_int = int(site_id) if site_id else None
    group_blocks = calculer_groupes(
        reports,
        groupes,
        sites,
        lines_by_group_report,
        site_report_state,
        groups_by_site_report,
        groupes_by_id,
        group_primary_site_ids,
        selected_site_id=site_id_as_int,
    )

    # 5. Déterminer la période sélectionnée
    start_idx, end_idx = resolve_period_indices(report_ids, rapport_debut_id, rapport_fin_id)
    period_label = (
        f"{reports[start_idx].date_debut.strftime('%d/%m/%Y')} → {reports[end_idx].date_fin.strftime('%d/%m/%Y')}"
        if reports
        else '—'
    )

    # 6. Calculer les statistiques agrégées pour la période
    site_hours_stats = _empty_window_stats()
    site_consumption_stats = _empty_window_stats()
    if site_id_as_int:
        # TODO: Calculer les stats pour le site sélectionné
        pass

    # 7. Préparer le contexte final pour l'API
    selected_rapport_debut = reports[start_idx] if reports else None
    selected_rapport_fin = reports[end_idx] if reports else None
    selected_site = next((s for s in sites if s.id == site_id_as_int), None)

    return {
        'rapport_choices': [
            {'id': r.id, 'label': f"R{r.id} ({r.date_debut.strftime('%d/%m')})"} for r in reports
        ],
        'selected_rapport_debut': selected_rapport_debut,
        'selected_rapport_fin': selected_rapport_fin,
        'selected_site_id': site_id_as_int,
        'selected_site': selected_site,
        'sites': sites,
        'period_label': period_label,
        'previous_period_label': _previous_period_label(report_labels, start_idx, end_idx),
        'site_hours_stats': site_hours_stats,
        'site_consumption_stats': site_consumption_stats,
        'group_blocks': group_blocks,
        'chart_labels_json': json.dumps(report_labels),
    }


def get_cuves_page_context(
    rapport_debut_id: int | None = None,
    rapport_fin_id: int | None = None,
    site_id: int | None = None,
) -> dict:
    """Prépare le contexte de données pour la page "Cuves"."""
    # 1. Récupérer les objets de base
    reports = list(Rapport.objects.order_by('date_debut', 'id'))
    sites = list(CuvePrincipale.objects.order_by('identifiant'))
    report_ids = [r.id for r in reports]
    report_labels = [r.date_debut.strftime('%d/%m') for r in reports]

    # 2. Sélectionner le site (le premier si non spécifié)
    site_id_as_int = int(site_id) if site_id else None
    if site_id_as_int is None and sites:
        site_id_as_int = sites[0].id
    selected_site = next((s for s in sites if s.id == site_id_as_int), None)

    # 3. Calculer les séries temporelles pour le site sélectionné
    volume_data, consumption_data = [], []
    if selected_site:
        lines_by_site_report = {}
        lines = LigneRapport.objects.select_related('cuve_journaliere').filter(rapport_id__in=report_ids)
        for line in lines:
            site_id_for_line = line.cuve_principale_id
            if not site_id_for_line and line.cuve_journaliere and line.cuve_journaliere.cuve_principale_id:
                site_id_for_line = line.cuve_journaliere.cuve_principale_id
            if site_id_for_line == site_id_as_int:
                lines_by_site_report.setdefault((site_id_as_int, line.rapport_id), []).append(line)

        volume_data, consumption_data = calculer_site_series(
            reports, lines_by_site_report, site_id_as_int
        )

    # 4. Déterminer la période et préparer le contexte
    start_idx, end_idx = resolve_period_indices(report_ids, rapport_debut_id, rapport_fin_id)
    period_label = (
        f"{reports[start_idx].date_debut.strftime('%d/%m/%Y')} → {reports[end_idx].date_fin.strftime('%d/%m/%Y')}"
        if reports
        else '—'
    )

    return {
        'rapport_choices': [
            {'id': r.id, 'label': f"R{r.id} ({r.date_debut.strftime('%d/%m')})"} for r in reports
        ],
        'selected_rapport_debut': reports[start_idx] if reports else None,
        'selected_rapport_fin': reports[end_idx] if reports else None,
        'selected_site_id': site_id_as_int,
        'selected_site': selected_site,
        'sites': sites,
        'period_label': period_label,
        'previous_period_label': _previous_period_label(report_labels, start_idx, end_idx),
        'site_principal_stats': _empty_window_stats(),
        'site_journalier_stats': _empty_window_stats(),
        'principal_blocks': [],
        'journalier_blocks': [],
        'chart_labels_json': json.dumps(report_labels),
        'volume_data_json': json.dumps(volume_data),
        'consumption_data_json': json.dumps(consumption_data),
    }
