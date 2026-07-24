"""Calculs analytiques partagés pour les dashboards CarburFlow."""

from __future__ import annotations

import json


GROUPE_COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14']
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


def build_groupe_timeseries():
    """Ce module analytique est temporairement neutralisé pendant la refonte du modèle."""
    return None


def resolve_period_indices(report_ids: list[int], debut_id=None, fin_id=None) -> tuple[int, int]:
    """Transforme des identifiants de rapports en indices de période.
    Si les IDs fournis ne sont pas valides, on revient à la période complète.
    """
    return 0, 0


def get_groupes_page_context(rapport_debut_id=None, rapport_fin_id=None, site_id=None) -> dict:
    """La page Groupes est temporairement neutralisée pendant la refonte du modèle."""
    return {
        'rapport_choices': [],
        'selected_rapport_debut': None,
        'selected_rapport_fin': None,
        'selected_site_id': None,
        'selected_site': None,
        'sites': [],
        'period_label': '—',
        'previous_period_label': None,
        'site_hours_stats': _empty_window_stats(),
        'site_consumption_stats': _empty_window_stats(),
        'group_blocks': [],
        'chart_labels_json': json.dumps([]),
    }


def get_cuves_page_context(rapport_debut_id=None, rapport_fin_id=None, site_id=None) -> dict:
    """La page Cuves est temporairement neutralisée pendant la refonte du modèle."""
    return {
        'rapport_choices': [],
        'selected_rapport_debut': None,
        'selected_rapport_fin': None,
        'selected_site_id': None,
        'selected_site': None,
        'sites': [],
        'period_label': '—',
        'previous_period_label': None,
        'site_principal_stats': _empty_window_stats(),
        'site_journalier_stats': _empty_window_stats(),
        'principal_blocks': [],
        'journalier_blocks': [],
        'chart_labels_json': json.dumps([]),
    }
