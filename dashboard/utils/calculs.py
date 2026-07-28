"""
Calculs partagés entre GroupesAPIView, SitesDashboardAPIView et
DashboardOverviewAPIView.

Ce module contient la logique métier principale pour le traitement des données de rapport,
notamment le calcul des consommations, des durées de fonctionnement et de l'autonomie.
"""

import re
import statistics



def extraire_puissance(value):
    """
    Extrait la valeur numérique d'une chaîne de caractères représentant la puissance.

def format_rapport_label(report) -> str:
    """Libellé période pour filtres / axes : date de début (jj/mm/aaaa)."""
    return report.date_debut.strftime('%d/%m/%Y')


def ordered_rapports(queryset=None):
    """Liste des rapports en ordre chronologique strict."""
    from dashboard.models import Rapport

    qs = queryset if queryset is not None else Rapport.objects.all()
    return list(qs.order_by('date_debut', 'date_fin', 'id'))


    Args:
        value (str or None): La chaîne de caractères (ex: "100 kVA").

    Returns:
        float: La valeur numérique de la puissance, ou 0.0 si non trouvée.
    """
    if value in (None, ''):
        return 0.0
    text = str(value).strip().replace(',', '.')
    match = re.search(r'(\d+(?:\.\d+)?)', text)
    return float(match.group(1)) if match else 0.0


def formater_autonomie(heures):
    """
    Formate une durée en heures en une chaîne de caractères lisible (ex: "3j12h").

    Args:
        heures (float or None): Le nombre d'heures.

    Returns:
        str: Une chaîne formatée représentant la durée, ou "∞" si l'entrée est None.
    """
    if heures is None:
        return "∞"
    if heures == 0:
        return "0h"
    t_mins = round(heures * 60)
    t_hrs = round(t_mins / 60)
    days = t_hrs // 24
    rem_h = t_hrs % 24
    return f"{days}j{rem_h}h" if days > 0 else f"{rem_h}h"


def moyenne(values):
    """
    Calcule la moyenne simple d'une liste de nombres.

    Args:
        values (list[float]): Une liste de nombres.

    Returns:
        float: La moyenne des valeurs, ou 0.0 si la liste est vide.
    """
    return sum(values) / len(values) if values else 0.0


def ecart_type(values):
    """
    Calcule l'écart-type d'une population.

    Args:
        values (list[float]): Une liste de nombres.

    Returns:
        float: L'écart-type des valeurs, ou 0.0 si la liste est vide.
    """
    if not values:
        return 0.0
    mean = moyenne(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return variance ** 0.5


def calculer_site_series(reports, lines_by_site_report, site_id):
    """
    Calcule les séries chronologiques de volume et de consommation pour un site donné.

    Args:
        reports (list[Rapport]): La liste des rapports, ordonnée par date.
        lines_by_site_report (dict): Un dictionnaire mappant (site_id, report_id) à une liste de lignes.
        site_id (int): L'ID du site à analyser.

    Returns:
        tuple[list[float], list[float]]: Un tuple contenant deux listes:
            - volume_data: L'historique du volume total du site pour chaque rapport.
            - consumption_data: L'historique de la consommation calculée pour chaque période de rapport.
    """
    volume_data = []
    consumption_data = []
    previous_volume = None

    for report in reports:
        lines = lines_by_site_report.get((site_id, report.id), [])
        current_volume = sum(
            float(l.quantite_gasoil_cuve_principale or 0.0)
            + float(l.quantite_gasoil_cuve_journaliere or 0.0)
            for l in lines
        )
        depotage_total = sum(float(l.depotage or 0.0) for l in lines)

        volume_data.append(round(current_volume, 1))

        if previous_volume is None:
            consumption_data.append(0.0)
        else:
            # Consommation = (Volume N-1) - (Volume N) + (Dépots N)
            consumption_data.append(
                round(max(0.0, previous_volume - current_volume + depotage_total), 1)
            )
        previous_volume = current_volume

    return volume_data, consumption_data


def build_site_report_state(reports, sites, lines_by_site_report):
    """
    Pré-calcule l'état (volume et consommation) de chaque site pour chaque rapport.

    Cette fonction est une optimisation pour `calculer_groupes`, afin d'éviter de
    recalculer la consommation de chaque site à l'intérieur de la boucle des groupes.

    Args:
        reports (list[Rapport]): La liste des rapports ordonnés.
        sites (list[CuvePrincipale]): La liste des sites.
        lines_by_site_report (dict): Dictionnaire de lignes indexées par (site_id, report_id).

    Returns:
        dict: Un dictionnaire où les clés sont (site_id, report_id) et les valeurs
              sont des dictionnaires contenant `current_volume` et `delta` (consommation).
    """
    site_report_state = {}
    for site in sites:
        previous_site_volume = None
        for report in reports:
            lines = lines_by_site_report.get((site.id, report.id), [])
            current_volume = sum(
                float(l.quantite_gasoil_cuve_principale or 0.0) + float(l.quantite_gasoil_cuve_journaliere or 0.0)
                for l in lines
            )
            depotage_total = sum(float(l.depotage or 0.0) for l in lines)

            delta = 0.0 if previous_site_volume is None else max(
                0.0, previous_site_volume - current_volume + depotage_total
            )

            site_report_state[(site.id, report.id)] = {
                'current_volume': current_volume,
                'delta': delta,
            }
            previous_site_volume = current_volume

    return site_report_state


def calculer_groupes(
    reports,
    groupes,
    sites,
    lines_by_group_report,
    site_report_state,
    groups_by_site_report,
    groupes_by_id,
    group_primary_site_ids,
    selected_site_id=None,
    groups_linked_by_site=None,
):
    """
    Calcule les données complètes pour chaque groupe avec partage de la
    consommation au prorata de la puissance.

    Autonomie (à l’instant T) :
      1. proportion = P_groupe / Σ P_groupes liés à la même cuve principale
      2. volume_proportionnel = (volume_CP × proportion) + volume_CJ_du_groupe
      3. autonomie_h = volume_proportionnel / conso_horaire_moyenne
         (moyenne des L/h significatifs, hors 0 et ∞)
    """
    # Groupes durablement rattachés à chaque site (via cuves journalières),
    # pour la proportion d’autonomie — pas seulement ceux présents sur un rapport.
    if groups_linked_by_site is None:
        from dashboard.models import CuveJournaliere

        groups_linked_by_site = {}
        for cj in CuveJournaliere.objects.filter(
            cuve_principale_id__isnull=False,
            groupe_electrogene_id__isnull=False,
        ).only('cuve_principale_id', 'groupe_electrogene_id'):
            g = groupes_by_id.get(cj.groupe_electrogene_id)
            if g is not None:
                groups_linked_by_site.setdefault(cj.cuve_principale_id, [])
                if g not in groups_linked_by_site[cj.cuve_principale_id]:
                    groups_linked_by_site[cj.cuve_principale_id].append(g)

        # Fallback : sites sans CJ → groupes déjà connus via primary_site
        for groupe in groupes:
            site_id = group_primary_site_ids.get(groupe.id)
            if site_id is not None:
                bucket = groups_linked_by_site.setdefault(site_id, [])
                if groupe not in bucket:
                    bucket.append(groupe)

    group_blocks = []
    for groupe in groupes:
        primary_site_id = group_primary_site_ids.get(groupe.id)
        if selected_site_id is not None and primary_site_id != selected_site_id:
            continue

        hours_run = []
        volume = []
        consumed_deltas = []
        previous_counter = None
        group_share = 1.0

        # Proportion stable (tous les groupes liés à la CP)
        linked_groups = list(groups_linked_by_site.get(primary_site_id, [])) if primary_site_id else [groupe]
        if groupe not in linked_groups:
            linked_groups = list(linked_groups) + [groupe]
        total_linked_power = sum(extraire_puissance(g.puissance) for g in linked_groups)
        group_power = extraire_puissance(groupe.puissance)
        if total_linked_power > 0:
            power_share = group_power / total_linked_power
        elif linked_groups:
            power_share = 1.0 / len(linked_groups)
        else:
            power_share = 1.0

        for report in reports:
            # 1. Calculer les heures de fonctionnement (delta du compteur)
            lines = lines_by_group_report.get((groupe.id, report.id), [])
            if primary_site_id is not None:
                lines = [l for l in lines if l.cuve_principale_id == primary_site_id]

            has_counter = False
            report_counter = 0.0
            for line in lines:
                if line.compteur_horaire is not None:
                    report_counter = max(report_counter, float(line.compteur_horaire))
                    has_counter = True

            if not has_counter:
                hour_delta = 0.0
            elif previous_counter is None:
                hour_delta = 0.0
                previous_counter = report_counter
            else:
                hour_delta = max(0.0, report_counter - previous_counter)
                previous_counter = report_counter
            hours_run.append(round(hour_delta, 1))

            # 2. Calculer la part de consommation du groupe
            site_state = site_report_state.get((primary_site_id, report.id), {}) if primary_site_id is not None else {}
            site_delta = float(site_state.get('delta', 0.0) or 0.0)

            site_current_volume = float(site_state.get('current_volume') or 0.0)

            # Conso période : partage au prorata des groupes ACTIFS sur ce rapport
            active_group_ids = (
                groups_by_site_report.get((primary_site_id, report.id), set())
                if primary_site_id is not None
                else set()
            )
            report_groups = [groupes_by_id[gid] for gid in active_group_ids if gid in groupes_by_id]
            total_power_report = sum(extraire_puissance(g.puissance) for g in report_groups)
            
            period_share = 1.0
            if total_power_report > 0:
                period_share = extraire_puissance(groupe.puissance) / total_power_report
            elif report_groups:
                period_share = 1.0 / len(report_groups)

            # Volume courbe / autonomie : proportion stable × volume CP réel
            weighted_report_volume = round(site_current_volume * power_share, 1)
            weighted_report_delta = round(site_delta * period_share, 1)

            volume.append(weighted_report_volume)
            consumed_deltas.append(weighted_report_delta)


        # 3. Calculer les métriques finales (consommation horaire, autonomie)
        total_hours = sum(h for h in hours_run if h > 0)
        total_consumed = sum(consumed_deltas)
        has_infinite_cons = any(h == 0 and d > 0 for h, d in zip(hours_run, consumed_deltas))

        # Consommation horaire moyenne (ratio des totaux), utilisée pour le calcul fiable de l'autonomie.
        if total_hours > 0:
            mean_hourly_consumption = total_consumed / total_hours
        else:
            mean_hourly_consumption = 0.0

        # Consommation horaire déduite (moyenne des ratios), pour l'affichage et la détection d'anomalies.
        per_period_rates = []
        for h, d in zip(hours_run, consumed_deltas):
            if h > 0:
                rate = round(d / h, 2)
                if rate > 0:
                    per_period_rates.append(rate)
        mean_hourly_consumption_deduite = (
            sum(per_period_rates) / len(per_period_rates) if per_period_rates else 0.0
        )

        # Consommation horaire de la dernière période.
        latest_hourly_consumption = None
        if hours_run and hours_run[-1] > 0 and consumed_deltas and consumed_deltas[-1] > 0:
            latest_hourly_consumption = consumed_deltas[-1] / hours_run[-1]

        last_report = reports[-1] if reports else None
        latest_main_volume = None
        latest_daily_volume = None
        if last_report and primary_site_id is not None:
            last_lines = lines_by_group_report.get((groupe.id, last_report.id), [])
            last_lines = [l for l in last_lines if l.cuve_principale_id == primary_site_id]
            if last_lines:
                cp_vals = [
                    float(l.quantite_gasoil_cuve_principale)
                    for l in last_lines
                    if l.quantite_gasoil_cuve_principale is not None
                ]
                cj_vals = [
                    float(l.quantite_gasoil_cuve_journaliere or 0.0)
                    for l in last_lines
                ]
                latest_main_volume = round(max(cp_vals), 1) if cp_vals else None
                latest_daily_volume = round(sum(cj_vals), 1) if cj_vals else None

        # Autonomie = (volume_CP × proportion + CJ groupe) / conso_horaire_moyenne
        volume_proportionnel = None
        if latest_main_volume is not None:
            cj_part = float(latest_daily_volume or 0.0)
            volume_proportionnel = round(latest_main_volume * power_share + cj_part, 1)
        autonomy_hours = None
        formatted_autonomy = None

        # Anomalie « conso sans delta horaire » : indépendante du calcul d’autonomie
        is_infinite_consumption = bool(has_infinite_cons)

        if mean_hourly_consumption_deduite > 0 and volume_proportionnel is not None:
            is_infinite_autonomy = False
            autonomy_hours = volume_proportionnel / mean_hourly_consumption_deduite
            formatted_autonomy = formater_autonomie(autonomy_hours)
        else:
            # Pas de conso horaire moyenne significative (« - ») → autonomie indéterminée
            is_infinite_autonomy = True
            autonomy_hours = None
            formatted_autonomy = "∞"

        group_blocks.append({
            'id': groupe.id,
            'label': groupe.identifiant,
            'site_id': primary_site_id,
            'site_nom': next((site.identifiant for site in sites if site.id == primary_site_id), ''),
            'puissance': groupe.puissance,
            'power_share': round(power_share, 4),
            'volume_proportionnel': volume_proportionnel,
            'hours_run': hours_run,
            'volume': volume,
            'consumption': consumed_deltas,
            'mean_hourly_consumption': round(mean_hourly_consumption, 3),  # ratio des sommes (autonomie)
            'mean_hourly_consumption_deduite': round(mean_hourly_consumption_deduite, 3),  # moyenne des ratios (affichage)
            'latest_hourly_consumption': round(latest_hourly_consumption, 3) if latest_hourly_consumption is not None else None,
            'autonomie_hours': round(autonomy_hours, 1) if autonomy_hours is not None else None,
            'formatted_autonomy': formatted_autonomy,
            'is_infinite_autonomy': is_infinite_autonomy,
            'is_infinite_consumption': is_infinite_consumption,
            'latest_main_volume': latest_main_volume,
            'latest_daily_volume': latest_daily_volume,
            'color': '#0b3d7a',
        })

    return group_blocks