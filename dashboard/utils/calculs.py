"""
Calculs partagés entre GroupesAPIView, SitesDashboardAPIView et
DashboardOverviewAPIView.

Règles importantes :
- Les rapports sont toujours parcourus dans l’ordre (date_debut, date_fin, id).
- Si un site/groupe n’a pas de ligne sur un rapport, on n’invente PAS un volume 0 :
  on pose null et on ne met pas à jour la référence précédente (évite les faux pics).
- Le premier point présent sert de baseline (delta conso / heures = 0).
- La série volume d’un groupe est le stock pondéré réel, pas la somme des deltas.
"""

import re


def format_rapport_label(report) -> str:
    """Libellé période pour filtres / axes : date de début (jj/mm/aaaa)."""
    return report.date_debut.strftime('%d/%m/%Y')


def ordered_rapports(queryset=None):
    """Liste des rapports en ordre chronologique strict."""
    from dashboard.models import Rapport

    qs = queryset if queryset is not None else Rapport.objects.all()
    return list(qs.order_by('date_debut', 'date_fin', 'id'))


def extraire_puissance(value):
    """Extrait la valeur numérique d'une puissance."""
    if value in (None, ''):
        return 0.0
    text = str(value).strip().replace(',', '.')
    match = re.search(r'(\d+(?:\.\d+)?)', text)
    return float(match.group(1)) if match else 0.0


def formater_autonomie(heures):
    """Formate une autonomie en heures en format lisible."""
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
    """Calcule la moyenne d'une liste de valeurs (ignore None)."""
    nums = [v for v in values if v is not None]
    return sum(nums) / len(nums) if nums else 0.0


def ecart_type(values):
    """Calcule l'écart type d'une liste de valeurs (ignore None)."""
    nums = [v for v in values if v is not None]
    if not nums:
        return 0.0
    mean = moyenne(nums)
    variance = sum((v - mean) ** 2 for v in nums) / len(nums)
    return variance ** 0.5


def last_finite(values):
    """Dernière valeur non-null d’une série."""
    for value in reversed(values or []):
        if value is not None:
            return value
    return None


def _site_volume_from_lines(lines) -> float:
    """
    Volume du site = stock réel de la cuve principale (une seule lecture).

    Chaque ligne groupe répète le même volume CP : on ne somme PAS les CP,
    ni les cuves journalières rattachées.
    """
    cp_values = [
        float(l.quantite_gasoil_cuve_principale)
        for l in lines
        if l.quantite_gasoil_cuve_principale is not None
    ]
    if not cp_values:
        return 0.0
    return max(cp_values)


def _site_depotage_from_lines(lines) -> float:
    """
    Dépotage site : si la même valeur est répétée sur chaque ligne groupe,
    on ne la compte qu’une fois ; sinon on somme les apports distincts.
    """
    values = [float(l.depotage or 0.0) for l in lines]
    nonzero = [v for v in values if v > 0]
    if not nonzero:
        return 0.0
    rounded = {round(v, 3) for v in nonzero}
    if len(rounded) == 1:
        return nonzero[0]
    return sum(nonzero)



def calculer_site_series(reports, lines_by_site_report, site_id):
    """
    Calcule les séries de volume et consommation pour un site.
    Retourne (volume_data, consumption_data) — null si pas de relevé sur le rapport.
    """
    volume_data = []
    consumption_data = []
    previous_volume = None

    for report in reports:
        lines = lines_by_site_report.get((site_id, report.id), [])
        if not lines:
            volume_data.append(None)
            consumption_data.append(None)
            continue

        current_volume = _site_volume_from_lines(lines)
        depotage_total = _site_depotage_from_lines(lines)
        volume_data.append(round(current_volume, 1))

        if previous_volume is None:
            consumption_data.append(0.0)
        else:
            consumption_data.append(
                round(max(0.0, previous_volume - current_volume + depotage_total), 1)
            )
        previous_volume = current_volume

    return volume_data, consumption_data


def build_site_report_state(reports, sites, lines_by_site_report):
    """
    Prépare l'état volume/delta par (site, rapport) pour le calcul des groupes.
    present=False si le site n’a aucune ligne sur ce rapport.
    """
    site_report_state = {}
    for site in sites:
        previous_site_volume = None
        for report in reports:
            lines = lines_by_site_report.get((site.id, report.id), [])
            if not lines:
                site_report_state[(site.id, report.id)] = {
                    'present': False,
                    'current_volume': None,
                    'delta': None,
                }
                continue

            current_volume = _site_volume_from_lines(lines)
            depotage_total = _site_depotage_from_lines(lines)

            if previous_site_volume is None:
                delta = 0.0
            else:
                delta = max(0.0, previous_site_volume - current_volume + depotage_total)

            site_report_state[(site.id, report.id)] = {
                'present': True,
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
        weighted_volumes = []
        consumed_deltas = []
        previous_counter = None

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
            lines = lines_by_group_report.get((groupe.id, report.id), [])
            if primary_site_id is not None:
                lines = [l for l in lines if l.cuve_principale_id == primary_site_id]

            site_state = (
                site_report_state.get((primary_site_id, report.id), {})
                if primary_site_id is not None
                else {}
            )
            site_present = bool(site_state.get('present')) and bool(lines)

            # Pas de relevé pour ce groupe sur ce rapport → null (pas de faux 0)
            if not site_present:
                hours_run.append(None)
                volume.append(None)
                weighted_volumes.append(None)
                consumed_deltas.append(None)
                continue

            has_counter = False
            report_counter = 0.0
            for line in lines:
                if line.compteur_horaire is not None:
                    report_counter = max(report_counter, float(line.compteur_horaire))
                    has_counter = True

            if not has_counter:
                hour_delta = None
            elif previous_counter is None:
                hour_delta = 0.0
                previous_counter = report_counter
            else:
                hour_delta = max(0.0, report_counter - previous_counter)
                previous_counter = report_counter

            hours_run.append(round(hour_delta, 1) if hour_delta is not None else None)

            site_current_volume = float(site_state.get('current_volume') or 0.0)
            site_delta = float(site_state.get('delta') or 0.0)

            # Conso période : partage au prorata des groupes ACTIFS sur ce rapport
            active_group_ids = (
                groups_by_site_report.get((primary_site_id, report.id), set())
                if primary_site_id is not None
                else set()
            )
            report_groups = [groupes_by_id[gid] for gid in active_group_ids if gid in groupes_by_id]
            total_power_report = sum(extraire_puissance(g.puissance) for g in report_groups)
            if total_power_report > 0:
                period_share = extraire_puissance(groupe.puissance) / total_power_report
            elif report_groups:
                period_share = 1.0 / len(report_groups)
            else:
                period_share = 1.0

            # Volume courbe / autonomie : proportion stable × volume CP réel
            weighted_report_volume = round(site_current_volume * power_share, 1)
            weighted_report_delta = round(site_delta * period_share, 1)

            volume.append(weighted_report_volume)
            weighted_volumes.append(weighted_report_volume)
            consumed_deltas.append(weighted_report_delta)

        finite_hours = [h for h in hours_run if h is not None and h > 0]
        finite_deltas = [d for d in consumed_deltas if d is not None]
        total_hours = sum(finite_hours)
        total_consumed = sum(d for d in finite_deltas if d > 0)
        has_infinite_cons = any(
            d is not None and d > 0 and (h is None or h == 0)
            for h, d in zip(hours_run, consumed_deltas)
        )

        if total_hours > 0:
            mean_hourly_consumption = total_consumed / total_hours
        else:
            mean_hourly_consumption = 0.0

        per_period_rates = []
        for h, d in zip(hours_run, consumed_deltas):
            if h is not None and h > 0 and d is not None:
                rate = round(d / h, 2)
                if rate > 0:
                    per_period_rates.append(rate)
        mean_hourly_consumption_deduite = (
            sum(per_period_rates) / len(per_period_rates) if per_period_rates else 0.0
        )

        latest_hourly_consumption = None
        for h, d in zip(reversed(hours_run), reversed(consumed_deltas)):
            if h is not None and h > 0 and d is not None and d > 0:
                latest_hourly_consumption = d / h
                break

        latest_main_volume = None
        latest_daily_volume = None
        for report in reversed(reports):
            last_lines = lines_by_group_report.get((groupe.id, report.id), [])
            if primary_site_id is not None:
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
                break

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
            'weighted_volume': weighted_volumes,
            'consumption': consumed_deltas,
            'mean_hourly_consumption': round(mean_hourly_consumption, 3),
            'mean_hourly_consumption_deduite': round(mean_hourly_consumption_deduite, 3),
            'latest_hourly_consumption': (
                round(latest_hourly_consumption, 3) if latest_hourly_consumption is not None else None
            ),
            'autonomie_hours': round(autonomy_hours, 1) if autonomy_hours is not None else None,
            'formatted_autonomy': formatted_autonomy,
            'is_infinite_autonomy': is_infinite_autonomy,
            'is_infinite_consumption': is_infinite_consumption,
            'latest_main_volume': latest_main_volume,
            'latest_daily_volume': latest_daily_volume,
            'color': '#0b3d7a',
        })

    return group_blocks
