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
        'Norme de dépôt des relevés. '
        'Une ligne = une combinaison cuve / groupe pour la période. '
        'Téléchargez le fichier modèle, remplacez l’exemple, puis importez.'
    ),
    'columns': [
        {
            'name': 'date_debut',
            'label': 'Date de début',
            'type': 'date',
            'required': True,
            'example': '2026-07-13',
            'help': 'Début de la période du relevé (AAAA-MM-JJ). Identique sur toutes les lignes.',
        },
        {
            'name': 'date_fin',
            'label': 'Date de fin',
            'type': 'date',
            'required': True,
            'example': '2026-07-17',
            'help': 'Fin de la période du relevé (AAAA-MM-JJ). Identique sur toutes les lignes.',
        },
        {
            'name': 'id_cuve_principale',
            'label': 'ID cuve principale',
            'type': 'int',
            'required': False,
            'example': '6001',
            'help': 'Identifiant numérique de la cuve principale (voir écran Sites / Cuves).',
        },
        {
            'name': 'id_cuve_journaliere',
            'label': 'ID cuve journalière',
            'type': 'int',
            'required': False,
            'example': '7001',
            'help': 'Identifiant de la cuve journalière liée, si applicable.',
        },
        {
            'name': 'id_groupe',
            'label': 'ID groupe électrogène',
            'type': 'int',
            'required': False,
            'example': '8001',
            'help': 'Identifiant du groupe électrogène concerné par le relevé.',
        },
        {
            'name': 'quantite_gasoil_cuve_principale',
            'label': 'Gasoil cuve principale (L)',
            'type': 'float',
            'required': False,
            'example': '4500',
            'help': 'Volume de gasoil mesuré dans la cuve principale, en litres.',
        },
        {
            'name': 'quantite_gasoil_cuve_journaliere',
            'label': 'Gasoil cuve journalière (L)',
            'type': 'float',
            'required': False,
            'example': '300',
            'help': 'Volume de gasoil dans la cuve journalière, en litres.',
        },
        {
            'name': 'compteur_horaire',
            'label': 'Compteur horaire',
            'type': 'float',
            'required': False,
            'example': '1210',
            'help': 'Relevé du compteur horaire du groupe (heures cumulées).',
        },
        {
            'name': 'depotage',
            'label': 'Dépotage (L)',
            'type': 'float',
            'required': False,
            'example': '0',
            'help': 'Volume dépoté sur la période, en litres (0 si aucun).',
        },
        {
            'name': 'etat_fonctionnement',
            'label': 'État de fonctionnement',
            'type': 'string',
            'required': False,
            'example': 'F',
            'help': 'Code d’état du groupe (ex. F = fonctionnement).',
        },
        {
            'name': 'observations',
            'label': 'Observations',
            'type': 'string',
            'required': False,
            'example': 'RAS',
            'help': 'Commentaire libre (incident, maintenance, RAS…).',
        },
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


def rapport_to_rows(rapport: Rapport) -> list[dict]:
    """Reconstitue les lignes au format norme pour export."""
    rows = []
    lignes = rapport.lignes.select_related(
        'cuve_principale',
        'cuve_journaliere',
        'groupe_electrogene',
    ).all()
    for ligne in lignes:
        rows.append({
            'date_debut': rapport.date_debut.isoformat() if rapport.date_debut else '',
            'date_fin': rapport.date_fin.isoformat() if rapport.date_fin else '',
            'id_cuve_principale': ligne.cuve_principale_id or '',
            'id_cuve_journaliere': ligne.cuve_journaliere_id or '',
            'id_groupe': ligne.groupe_electrogene_id or '',
            'quantite_gasoil_cuve_principale': ligne.quantite_gasoil_cuve_principale
            if ligne.quantite_gasoil_cuve_principale is not None
            else '',
            'quantite_gasoil_cuve_journaliere': ligne.quantite_gasoil_cuve_journaliere
            if ligne.quantite_gasoil_cuve_journaliere is not None
            else '',
            'compteur_horaire': ligne.compteur_horaire if ligne.compteur_horaire is not None else '',
            'depotage': ligne.depotage if ligne.depotage is not None else '',
            'etat_fonctionnement': ligne.etat_fonctionnement or '',
            'observations': ligne.observations or '',
        })
    return rows


def build_rapport_csv_bytes(rapport: Rapport) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=NORME_COLUMNS, lineterminator='\n')
    writer.writeheader()
    for row in rapport_to_rows(rapport):
        writer.writerow(row)
    return buffer.getvalue().encode('utf-8-sig')


def build_rapport_xlsx_bytes(rapport: Rapport) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = 'Rapport'
    ws.append(NORME_COLUMNS)
    for row in rapport_to_rows(rapport):
        ws.append([row.get(col, '') for col in NORME_COLUMNS])

    meta = wb.create_sheet('Meta')
    meta.append(['champ', 'valeur'])
    meta.append(['rapport_id', rapport.id])
    meta.append(['date_debut', str(rapport.date_debut)])
    meta.append(['date_fin', str(rapport.date_fin)])
    if rapport.created_by_id:
        meta.append(['created_by', rapport.created_by.get_username()])

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


COLUMN_LABELS = {
    col['name']: col.get('label') or col['name'] for col in NORME_META['columns']
}


class ImportValidationError(Exception):
    """Erreur d'import avec détails compréhensibles (ligne / colonne)."""

    def __init__(self, message: str, errors: list[dict] | None = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or []

    def as_dict(self) -> dict:
        return {
            'detail': self.message,
            'errors': self.errors,
        }


def _friendly_error(
    *,
    row: int | None,
    column: str | None,
    message: str,
    how_to_fix: str,
) -> dict:
    return {
        'row': row,
        'column': column,
        'column_label': COLUMN_LABELS.get(column or '', column),
        'message': message,
        'how_to_fix': how_to_fix,
    }


def _parse_date(value: Any, *, row: int | None = None, column: str = 'date') -> date | None:
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
    label = COLUMN_LABELS.get(column, column)
    raise ImportValidationError(
        f'Une date n’est pas au bon format (ligne {row}).',
        [
            _friendly_error(
                row=row,
                column=column,
                message=f'La valeur « {text} » n’est pas une date reconnue pour « {label} ».',
                how_to_fix='Écrivez la date comme ceci : 13/07/2026 ou 2026-07-13.',
            )
        ],
    )


def _to_float(value: Any, default: float = 0.0, *, row: int | None = None, column: str | None = None) -> float:
    if value is None or value == '':
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(',', '.').replace(' ', '')
    if not text:
        return default
    try:
        return float(text)
    except ValueError as exc:
        label = COLUMN_LABELS.get(column or '', column or 'nombre')
        raise ImportValidationError(
            f'Un nombre est incorrect (ligne {row}).',
            [
                _friendly_error(
                    row=row,
                    column=column,
                    message=f'La valeur « {value} » n’est pas un nombre valide pour « {label} ».',
                    how_to_fix='Mettez uniquement un nombre, par exemple 4500 ou 12,5 (sans lettres).',
                )
            ],
        ) from exc


def _to_int_or_none(value: Any, *, row: int | None = None, column: str | None = None) -> int | None:
    if value is None or value == '':
        return None
    try:
        if isinstance(value, float):
            return int(value)
        text = str(value).strip()
        if not text:
            return None
        return int(float(text))
    except ValueError as exc:
        label = COLUMN_LABELS.get(column or '', column or 'identifiant')
        raise ImportValidationError(
            f'Un numéro est incorrect (ligne {row}).',
            [
                _friendly_error(
                    row=row,
                    column=column,
                    message=f'La valeur « {value} » n’est pas un numéro valide pour « {label} ».',
                    how_to_fix='Mettez uniquement le numéro de la cuve ou du groupe (chiffres, sans lettres).',
                )
            ],
        ) from exc


def _normalize_headers(headers: list[str]) -> list[str]:
    return [str(h or '').strip().lower() for h in headers]


def _missing_required_columns(headers: list[str]) -> list[dict]:
    missing = [c for c in ('date_debut', 'date_fin') if c not in headers]
    if not missing:
        return []
    return [
        _friendly_error(
            row=1,
            column=col,
            message=f'La colonne « {COLUMN_LABELS.get(col, col)} » est absente du fichier.',
            how_to_fix='Retéléchargez le modèle (étape 1) et ne renommez pas les titres des colonnes.',
        )
        for col in missing
    ]


def _detect_csv_delimiter(sample: str) -> str:
    """Détecte ; ou , (Excel FR utilise souvent ;)."""
    first_line = (sample.splitlines() or [''])[0]
    if first_line.count(';') >= first_line.count(','):
        return ';'
    return ','


def rows_from_csv(file_bytes: bytes) -> list[dict]:
    try:
        text = file_bytes.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise ImportValidationError(
            'Le fichier CSV n’est pas lisible.',
            [
                _friendly_error(
                    row=None,
                    column=None,
                    message='Le fichier semble mal enregistré (encodage incorrect).',
                    how_to_fix='Enregistrez le fichier en CSV UTF-8, ou utilisez plutôt le modèle Excel.',
                )
            ],
        ) from exc
    delimiter = _detect_csv_delimiter(text)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ImportValidationError(
            'Le fichier CSV est vide ou sans titres de colonnes.',
            [
                _friendly_error(
                    row=1,
                    column=None,
                    message='La première ligne (titres) est manquante.',
                    how_to_fix='Utilisez le modèle téléchargé à l’étape 1 : la 1re ligne doit contenir les noms des colonnes.',
                )
            ],
        )
    headers = _normalize_headers(reader.fieldnames)
    missing_errors = _missing_required_columns(headers)
    if missing_errors:
        raise ImportValidationError(
            'Il manque des colonnes obligatoires dans votre fichier.',
            missing_errors,
        )
    rows = []
    for raw in reader:
        row = {k.strip().lower(): v for k, v in raw.items() if k}
        if not any(str(v or '').strip() for v in row.values()):
            continue
        rows.append(row)
    return rows


def rows_from_xlsx(file_bytes: bytes) -> list[dict]:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as exc:
        raise ImportValidationError(
            'Le fichier Excel n’a pas pu être ouvert.',
            [
                _friendly_error(
                    row=None,
                    column=None,
                    message='Le fichier est peut-être endommagé ou n’est pas un vrai Excel.',
                    how_to_fix='Retéléchargez le modèle Excel, recopiez vos données dedans, puis réessayez.',
                )
            ],
        ) from exc
    ws = wb[wb.sheetnames[0]]
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration as exc:
        raise ImportValidationError(
            'Le fichier Excel est vide.',
            [
                _friendly_error(
                    row=1,
                    column=None,
                    message='Aucune ligne trouvée dans la première feuille.',
                    how_to_fix='Utilisez le modèle de l’étape 1 et ajoutez vos lignes sous les titres.',
                )
            ],
        ) from exc
    headers = _normalize_headers(list(header_row))
    missing_errors = _missing_required_columns(headers)
    if missing_errors:
        raise ImportValidationError(
            'Il manque des colonnes obligatoires dans votre fichier.',
            missing_errors,
        )
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
        raise ImportValidationError(
            'Votre fichier est vide : il n’y a aucune ligne de relevé.',
            [
                _friendly_error(
                    row=2,
                    column=None,
                    message='Le fichier ne contient que les titres, sans ligne de relevé.',
                    how_to_fix='Ajoutez au moins une ligne sous les titres (remplacez l’exemple du modèle).',
                )
            ],
        )

    errors: list[dict] = []
    date_debut = None
    date_fin = None

    def _safe_parse_date(value, *, row: int, column: str):
        raw = value
        if raw is None or str(raw).strip() == '':
            errors.append(
                _friendly_error(
                    row=row,
                    column=column,
                    message=(
                        'La date de début est vide.'
                        if column == 'date_debut'
                        else 'La date de fin est vide.'
                    ),
                    how_to_fix=(
                        'Remplissez la colonne « Date de début » (ex. 13/07/2026).'
                        if column == 'date_debut'
                        else 'Remplissez la colonne « Date de fin » (ex. 17/07/2026).'
                    ),
                )
            )
            return None
        try:
            return _parse_date(raw, row=row, column=column)
        except ImportValidationError as exc:
            errors.extend(exc.errors)
            return None

    # Ligne Excel/CSV = index + 2 (1 = titres, données à partir de 2)
    for idx, row in enumerate(rows):
        excel_row = idx + 2
        d1 = _safe_parse_date(row.get('date_debut'), row=excel_row, column='date_debut')
        d2 = _safe_parse_date(row.get('date_fin'), row=excel_row, column='date_fin')
        if idx == 0:
            date_debut, date_fin = d1, d2
        elif date_debut and date_fin and d1 and d2 and (d1 != date_debut or d2 != date_fin):
            errors.append(
                _friendly_error(
                    row=excel_row,
                    column='date_debut',
                    message='Cette ligne n’a pas la même période que les autres.',
                    how_to_fix=(
                        f'Mettez partout les mêmes dates : '
                        f'{date_debut.strftime("%d/%m/%Y")} → {date_fin.strftime("%d/%m/%Y")}.'
                    ),
                )
            )

        for col in (
            'id_cuve_principale',
            'id_cuve_journaliere',
            'id_groupe',
        ):
            try:
                _to_int_or_none(row.get(col), row=excel_row, column=col)
            except ImportValidationError as exc:
                errors.extend(exc.errors)
        for col in (
            'quantite_gasoil_cuve_principale',
            'quantite_gasoil_cuve_journaliere',
            'compteur_horaire',
            'depotage',
        ):
            try:
                _to_float(row.get(col), row=excel_row, column=col)
            except ImportValidationError as exc:
                errors.extend(exc.errors)

    if errors:
        n = len(errors)
        raise ImportValidationError(
            (
                'Il y a 1 point à corriger dans votre fichier.'
                if n == 1
                else f'Il y a {n} points à corriger dans votre fichier.'
            ),
            errors[:30],
        )

    if not date_debut or not date_fin:
        raise ImportValidationError(
            'Les dates de période sont manquantes.',
            [
                _friendly_error(
                    row=2,
                    column='date_debut',
                    message='Impossible de lire la période du relevé.',
                    how_to_fix='Remplissez les colonnes Date de début et Date de fin (ex. 13/07/2026).',
                )
            ],
        )

    rapport = Rapport.objects.create(
        date_debut=date_debut,
        date_fin=date_fin,
        created_by=user,
    )

    imported = 0
    for idx, row in enumerate(rows):
        excel_row = idx + 2
        cp_id = _to_int_or_none(row.get('id_cuve_principale'), row=excel_row, column='id_cuve_principale')
        cj_id = _to_int_or_none(row.get('id_cuve_journaliere'), row=excel_row, column='id_cuve_journaliere')
        g_id = _to_int_or_none(row.get('id_groupe'), row=excel_row, column='id_groupe')

        cuve_principale = CuvePrincipale.objects.filter(pk=cp_id).first() if cp_id else None
        cuve_journaliere = CuveJournaliere.objects.filter(pk=cj_id).first() if cj_id else None
        groupe = GroupeElectrogene.objects.filter(pk=g_id).first() if g_id else None

        LigneRapport.objects.create(
            rapport=rapport,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            groupe_electrogene=groupe,
            quantite_gasoil_cuve_principale=_to_float(
                row.get('quantite_gasoil_cuve_principale'),
                row=excel_row,
                column='quantite_gasoil_cuve_principale',
            ),
            quantite_gasoil_cuve_journaliere=_to_float(
                row.get('quantite_gasoil_cuve_journaliere'),
                row=excel_row,
                column='quantite_gasoil_cuve_journaliere',
            ),
            compteur_horaire=_to_float(
                row.get('compteur_horaire'),
                row=excel_row,
                column='compteur_horaire',
            ),
            depotage=_to_float(row.get('depotage'), row=excel_row, column='depotage'),
            etat_fonctionnement=str(row.get('etat_fonctionnement') or 'F').strip() or 'F',
            observations=str(row.get('observations') or '').strip(),
        )
        imported += 1

    return rapport, imported
