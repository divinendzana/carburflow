"""Norme de rapport CarburFlow — colonnes alignées sur le CSV métier."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any

from django.db import transaction

from dashboard.models import (
    CuveJournaliere,
    CuvePrincipale,
    GroupeElectrogene,
    LigneRapport,
    Rapport,
)

# Colonnes de la norme (Excel ↔ CSV). Compatible avec ligne_rapport + dates de période.
NORME_COLUMNS = [
    'date_debut',
    'date_fin',
    'id_cuve_principale',
    'id_cuve_journaliere',
    'id_groupe',
    'quantite_gasoil_cuve_principale',
    'quantite_gasoil_cuve_journaliere',
    'compteur_horaire',
    'depotage',
    'etat_fonctionnement',
    'observations',
]

NORME_META = {
    'format': 'CarburFlow Rapport v1',
    'description': (
        'Norme de dépôt des relevés hebdomadaires. '
        'Remplir une ligne par combinaison cuve/groupe. '
        'Exporter en CSV depuis Excel (UTF-8) si besoin.'
    ),
    'columns': [
        {'name': 'date_debut', 'type': 'date', 'required': True, 'example': '2026-07-13'},
        {'name': 'date_fin', 'type': 'date', 'required': True, 'example': '2026-07-17'},
        {'name': 'id_cuve_principale', 'type': 'int', 'required': False, 'example': '6001'},
        {'name': 'id_cuve_journaliere', 'type': 'int', 'required': False, 'example': '7001'},
        {'name': 'id_groupe', 'type': 'int', 'required': False, 'example': '8001'},
        {'name': 'quantite_gasoil_cuve_principale', 'type': 'float', 'required': False, 'example': '4500'},
        {'name': 'quantite_gasoil_cuve_journaliere', 'type': 'float', 'required': False, 'example': '300'},
        {'name': 'compteur_horaire', 'type': 'float', 'required': False, 'example': '1210'},
        {'name': 'depotage', 'type': 'float', 'required': False, 'example': '0'},
        {'name': 'etat_fonctionnement', 'type': 'string', 'required': False, 'example': 'F'},
        {'name': 'observations', 'type': 'string', 'required': False, 'example': 'RAS'},
    ],
}

SAMPLE_ROWS = [
    {
        'date_debut': '2026-07-13',
        'date_fin': '2026-07-17',
        'id_cuve_principale': '6001',
        'id_cuve_journaliere': '7001',
        'id_groupe': '8001',
        'quantite_gasoil_cuve_principale': '8448',
        'quantite_gasoil_cuve_journaliere': '1000',
        'compteur_horaire': '1864',
        'depotage': '0',
        'etat_fonctionnement': 'F',
        'observations': 'RAS',
    },
]


def build_csv_bytes(include_sample: bool = True) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=NORME_COLUMNS, lineterminator='\n')
    writer.writeheader()
    if include_sample:
        for row in SAMPLE_ROWS:
            writer.writerow(row)
    return buffer.getvalue().encode('utf-8-sig')


def build_xlsx_bytes(include_sample: bool = True) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = 'Rapport'
    ws.append(NORME_COLUMNS)
    if include_sample:
        for row in SAMPLE_ROWS:
            ws.append([row.get(col, '') for col in NORME_COLUMNS])

    meta = wb.create_sheet('Meta')
    meta.append(['champ', 'valeur'])
    meta.append(['format', NORME_META['format']])
    meta.append(['description', NORME_META['description']])
    meta.append(['colonnes', ', '.join(NORME_COLUMNS)])

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _parse_date(value: Any) -> date | None:
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f'Date invalide: {value!r}')


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == '':
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(',', '.').replace(' ', '')
    if not text:
        return default
    return float(text)


def _to_int_or_none(value: Any) -> int | None:
    if value is None or value == '':
        return None
    if isinstance(value, float):
        return int(value)
    text = str(value).strip()
    if not text:
        return None
    return int(float(text))


def _normalize_headers(headers: list[str]) -> list[str]:
    return [str(h or '').strip().lower() for h in headers]


def rows_from_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError('CSV sans en-tête.')
    headers = _normalize_headers(reader.fieldnames)
    missing = [c for c in ('date_debut', 'date_fin') if c not in headers]
    if missing:
        raise ValueError(f'Colonnes obligatoires manquantes: {", ".join(missing)}')
    rows = []
    for raw in reader:
        row = {k.strip().lower(): v for k, v in raw.items() if k}
        if not any(str(v or '').strip() for v in row.values()):
            continue
        rows.append(row)
    return rows


def rows_from_xlsx(file_bytes: bytes) -> list[dict]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration as exc:
        raise ValueError('Fichier Excel vide.') from exc
    headers = _normalize_headers(list(header_row))
    missing = [c for c in ('date_debut', 'date_fin') if c not in headers]
    if missing:
        raise ValueError(f'Colonnes obligatoires manquantes: {", ".join(missing)}')
    rows = []
    for values in rows_iter:
        if values is None or all(v is None or str(v).strip() == '' for v in values):
            continue
        row = {}
        for idx, key in enumerate(headers):
            if not key:
                continue
            row[key] = values[idx] if idx < len(values) else None
        rows.append(row)
    return rows


@transaction.atomic
def import_report_rows(rows: list[dict], user) -> tuple[Rapport, int]:
    if not rows:
        raise ValueError('Aucune ligne de données à importer.')

    date_debut = _parse_date(rows[0].get('date_debut'))
    date_fin = _parse_date(rows[0].get('date_fin'))
    if not date_debut or not date_fin:
        raise ValueError('date_debut et date_fin sont obligatoires.')

    for row in rows:
        d1 = _parse_date(row.get('date_debut'))
        d2 = _parse_date(row.get('date_fin'))
        if d1 != date_debut or d2 != date_fin:
            raise ValueError('Toutes les lignes doivent partager la même période (date_debut / date_fin).')

    rapport = Rapport.objects.create(
        date_debut=date_debut,
        date_fin=date_fin,
        created_by=user,
    )

    imported = 0
    for row in rows:
        cp_id = _to_int_or_none(row.get('id_cuve_principale'))
        cj_id = _to_int_or_none(row.get('id_cuve_journaliere'))
        g_id = _to_int_or_none(row.get('id_groupe'))

        cuve_principale = CuvePrincipale.objects.filter(pk=cp_id).first() if cp_id else None
        cuve_journaliere = CuveJournaliere.objects.filter(pk=cj_id).first() if cj_id else None
        groupe = GroupeElectrogene.objects.filter(pk=g_id).first() if g_id else None

        LigneRapport.objects.create(
            rapport=rapport,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            groupe_electrogene=groupe,
            quantite_gasoil_cuve_principale=_to_float(row.get('quantite_gasoil_cuve_principale')),
            quantite_gasoil_cuve_journaliere=_to_float(row.get('quantite_gasoil_cuve_journaliere')),
            compteur_horaire=_to_float(row.get('compteur_horaire')),
            depotage=_to_float(row.get('depotage')),
            etat_fonctionnement=str(row.get('etat_fonctionnement') or 'F').strip() or 'F',
            observations=str(row.get('observations') or '').strip(),
        )
        imported += 1

    return rapport, imported
