"""
Pipeline d'import de rapports CarburFlow (3 étapes) — fiches de suivi.

1. analyze_rapport_* : cohérence + nouveaux sites / cuves journalières / groupes
2. create_entities_from_analysis : création des entités manquantes
3. import_rapport_lignes : Rapport + LigneRapport

Identifiants terrain :
- id_cuve_principale = nom du site (string), une cuve principale = un site
- id_cuve_journaliere = nom de la cuve journalière (string)
- id_groupe = numéro (int)
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date as date_cls
from pathlib import Path

from django.db import transaction

from dashboard.models import (
    CuveJournaliere,
    CuvePrincipale,
    GroupeElectrogene,
    LigneRapport,
    Rapport,
)
from dashboard.norme import (
    ImportValidationError,
    _friendly_error,
    _parse_date,
    _to_float,
    _to_int_or_none,
    _to_name_or_none,
    normalize_row_keys,
    rows_from_csv,
    rows_from_xlsx,
)


@dataclass
class EntityRef:
    kind: str  # cuve_principale | cuve_journaliere | groupe
    key: str  # nom site / nom CJ / id groupe en str
    label: str
    exists: bool
    sample_rows: list[int] = field(default_factory=list)


@dataclass
class AnalysisIssue:
    level: str  # error | warning
    row: int | None
    column: str | None
    message: str
    how_to_fix: str = ''


@dataclass
class AnalysisResult:
    ok: bool
    row_count: int
    date_debut: str | None
    date_fin: str | None
    issues: list[AnalysisIssue] = field(default_factory=list)
    known_cuves_principales: list[EntityRef] = field(default_factory=list)
    known_cuves_journalieres: list[EntityRef] = field(default_factory=list)
    known_groupes: list[EntityRef] = field(default_factory=list)
    new_cuves_principales: list[EntityRef] = field(default_factory=list)
    new_cuves_journalieres: list[EntityRef] = field(default_factory=list)
    new_groupes: list[EntityRef] = field(default_factory=list)
    # Liens suggérés pour création CJ : nom_cj → {site, groupe_id}
    cj_links: dict[str, dict] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def errors(self) -> list[AnalysisIssue]:
        return [i for i in self.issues if i.level == 'error']

    @property
    def warnings(self) -> list[AnalysisIssue]:
        return [i for i in self.issues if i.level == 'warning']


@dataclass
class CreateResult:
    created_cuves_principales: list[str] = field(default_factory=list)
    created_cuves_journalieres: list[str] = field(default_factory=list)
    created_groupes: list[int] = field(default_factory=list)
    skipped_existing: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ImportResult:
    rapport_id: int
    imported_lines: int
    date_debut: str
    date_fin: str
    created_entities: CreateResult | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def load_rapport_rows(path: str | Path) -> list[dict]:
    path = Path(path)
    if not path.exists():
        raise ImportValidationError(
            f'Fichier introuvable : {path}',
            [
                _friendly_error(
                    row=None,
                    column=None,
                    message=f'Le fichier « {path} » n’existe pas.',
                    how_to_fix='Vérifiez le chemin du fichier .xlsx ou .csv.',
                )
            ],
        )
    raw = path.read_bytes()
    lower = path.name.lower()
    if lower.endswith('.xlsx'):
        return rows_from_xlsx(raw)
    if lower.endswith('.csv'):
        return rows_from_csv(raw)
    raise ImportValidationError(
        'Type de fichier non accepté.',
        [
            _friendly_error(
                row=None,
                column=None,
                message=f'Le fichier « {path.name} » n’est pas un Excel ou un CSV.',
                how_to_fix='Utilisez un fichier .xlsx ou .csv au format fiche de suivi.',
            )
        ],
    )


def load_rapport_rows_from_bytes(filename: str, raw: bytes) -> list[dict]:
    lower = (filename or '').lower()
    if lower.endswith('.xlsx'):
        return rows_from_xlsx(raw)
    if lower.endswith('.csv'):
        return rows_from_csv(raw)
    raise ImportValidationError(
        'Type de fichier non accepté.',
        [
            _friendly_error(
                row=None,
                column=None,
                message=f'Le fichier « {filename} » n’est pas un Excel ou un CSV.',
                how_to_fix='Choisissez un fichier .xlsx ou .csv (modèle étape 1).',
            )
        ],
    )


def _lookup_cp(name: str | None) -> CuvePrincipale | None:
    if not name:
        return None
    return CuvePrincipale.objects.filter(identifiant__iexact=name.strip()).first()


def _lookup_cj(name: str | None) -> CuveJournaliere | None:
    if not name:
        return None
    return CuveJournaliere.objects.filter(identifiant__iexact=name.strip()).first()


def _lookup_groupe(gid: int | None) -> GroupeElectrogene | None:
    if gid is None:
        return None
    return GroupeElectrogene.objects.filter(pk=gid).first()


def analyze_rapport_rows(rows: list[dict]) -> AnalysisResult:
    issues: list[AnalysisIssue] = []
    rows = [normalize_row_keys(r) for r in rows]

    if not rows:
        issues.append(
            AnalysisIssue(
                level='error',
                row=2,
                column=None,
                message='Aucune ligne de relevé dans le fichier.',
                how_to_fix='Ajoutez au moins une ligne sous les titres.',
            )
        )
        return AnalysisResult(ok=False, row_count=0, date_debut=None, date_fin=None, issues=issues)

    date_debut = None
    date_fin = None
    seen_keys: dict[tuple, int] = {}

    cp_names: dict[str, list[int]] = {}
    cj_names: dict[str, list[int]] = {}
    g_ids: dict[int, list[int]] = {}
    cj_links: dict[str, dict] = {}

    for idx, row in enumerate(rows):
        excel_row = idx + 2
        d1 = d2 = None

        try:
            raw_d1 = row.get('date_debut')
            if raw_d1 is None or str(raw_d1).strip() == '':
                issues.append(
                    AnalysisIssue(
                        level='error',
                        row=excel_row,
                        column='date_debut',
                        message='Date de début vide.',
                        how_to_fix='Remplissez la colonne Date de début (ex. 13/07/2026).',
                    )
                )
            else:
                d1 = _parse_date(raw_d1, row=excel_row, column='date_debut')
        except ImportValidationError as exc:
            for err in exc.errors:
                issues.append(
                    AnalysisIssue(
                        level='error',
                        row=err.get('row'),
                        column=err.get('column'),
                        message=err.get('message') or str(exc),
                        how_to_fix=err.get('how_to_fix') or '',
                    )
                )

        try:
            raw_d2 = row.get('date_fin')
            if raw_d2 is None or str(raw_d2).strip() == '':
                issues.append(
                    AnalysisIssue(
                        level='error',
                        row=excel_row,
                        column='date_fin',
                        message='Date de fin vide.',
                        how_to_fix='Remplissez la colonne Date de fin (ex. 17/07/2026).',
                    )
                )
            else:
                d2 = _parse_date(raw_d2, row=excel_row, column='date_fin')
        except ImportValidationError as exc:
            for err in exc.errors:
                issues.append(
                    AnalysisIssue(
                        level='error',
                        row=err.get('row'),
                        column=err.get('column'),
                        message=err.get('message') or str(exc),
                        how_to_fix=err.get('how_to_fix') or '',
                    )
                )

        if idx == 0:
            date_debut, date_fin = d1, d2
        elif date_debut and date_fin and d1 and d2 and (d1 != date_debut or d2 != date_fin):
            issues.append(
                AnalysisIssue(
                    level='error',
                    row=excel_row,
                    column='date_debut',
                    message='Période différente des autres lignes.',
                    how_to_fix=(
                        f'Mettez partout : {date_debut.strftime("%d/%m/%Y")} → '
                        f'{date_fin.strftime("%d/%m/%Y")}.'
                    ),
                )
            )

        if d1 and d2 and d1 > d2:
            issues.append(
                AnalysisIssue(
                    level='error',
                    row=excel_row,
                    column='date_debut',
                    message='La date de début est après la date de fin.',
                    how_to_fix='Inversez ou corrigez les deux dates.',
                )
            )

        cp_name = _to_name_or_none(row.get('id_cuve_principale'))
        cj_name = _to_name_or_none(row.get('id_cuve_journaliere'))
        g_id = None
        try:
            g_id = _to_int_or_none(row.get('id_groupe'), row=excel_row, column='id_groupe')
        except ImportValidationError as exc:
            for err in exc.errors:
                issues.append(
                    AnalysisIssue(
                        level='error',
                        row=err.get('row'),
                        column=err.get('column'),
                        message=err.get('message') or str(exc),
                        how_to_fix=err.get('how_to_fix') or '',
                    )
                )

        for col in (
            'quantités_cuve_principale',
            'quantite_cuve_journaliere',
            'compteur_horaire',
            'depotage',
        ):
            try:
                val = _to_float(row.get(col), row=excel_row, column=col)
                if val < 0:
                    issues.append(
                        AnalysisIssue(
                            level='warning',
                            row=excel_row,
                            column=col,
                            message=f'Valeur négative ({val}) pour {col}.',
                            how_to_fix='Vérifiez le relevé : les volumes / compteurs sont en principe ≥ 0.',
                        )
                    )
            except ImportValidationError as exc:
                for err in exc.errors:
                    issues.append(
                        AnalysisIssue(
                            level='error',
                            row=err.get('row'),
                            column=err.get('column'),
                            message=err.get('message') or str(exc),
                            how_to_fix=err.get('how_to_fix') or '',
                        )
                    )

        if not any([cp_name, cj_name, g_id is not None]):
            issues.append(
                AnalysisIssue(
                    level='warning',
                    row=excel_row,
                    column='id_cuve_principale',
                    message='Aucun site / cuve / groupe renseigné sur cette ligne.',
                    how_to_fix='Indiquez au moins le nom du site ou le n° de groupe.',
                )
            )

        key = (cp_name, cj_name, g_id)
        if any(key) and key in seen_keys:
            issues.append(
                AnalysisIssue(
                    level='warning',
                    row=excel_row,
                    column=None,
                    message=(
                        f'Ligne en double avec la ligne {seen_keys[key]} '
                        f'(même site / cuve journalière / groupe).'
                    ),
                    how_to_fix='Supprimez le doublon ou corrigez les identifiants.',
                )
            )
        elif any(key):
            seen_keys[key] = excel_row

        if cp_name:
            cp_names.setdefault(cp_name, []).append(excel_row)
        if cj_name:
            cj_names.setdefault(cj_name, []).append(excel_row)
            link = cj_links.setdefault(cj_name, {'site': None, 'groupe_id': None})
            if cp_name:
                link['site'] = cp_name
            if g_id is not None:
                link['groupe_id'] = g_id
        if g_id is not None:
            g_ids.setdefault(g_id, []).append(excel_row)

    existing_cp = {}
    if cp_names:
        wanted = {n.strip().upper() for n in cp_names}
        for obj in CuvePrincipale.objects.exclude(identifiant='').only('identifiant'):
            if not obj.identifiant:
                continue
            key = obj.identifiant.strip().upper()
            if key in wanted:
                existing_cp[key] = obj.identifiant

    existing_cj = {}
    if cj_names:
        wanted = {n.strip().upper() for n in cj_names}
        for obj in CuveJournaliere.objects.exclude(identifiant__isnull=True).exclude(identifiant='').only('identifiant'):
            key = obj.identifiant.strip().upper()
            if key in wanted:
                existing_cj[key] = obj.identifiant

    existing_g = set(
        GroupeElectrogene.objects.filter(pk__in=g_ids.keys()).values_list('pk', flat=True)
    ) if g_ids else set()

    def _split_names(names_map: dict[str, list[int]], existing_map: dict[str, str], kind: str, prefix: str):
        known, new = [], []
        for name, sample in sorted(names_map.items(), key=lambda x: x[0].upper()):
            exists = name.strip().upper() in existing_map
            ref = EntityRef(
                kind=kind,
                key=name,
                label=f'{prefix} « {name} »',
                exists=exists,
                sample_rows=sample[:5],
            )
            (known if exists else new).append(ref)
        return known, new

    known_cp, new_cp = _split_names(cp_names, existing_cp, 'cuve_principale', 'Site')
    known_cj, new_cj = _split_names(cj_names, existing_cj, 'cuve_journaliere', 'Cuve journalière')

    known_g, new_g = [], []
    for gid, sample in sorted(g_ids.items()):
        ref = EntityRef(
            kind='groupe',
            key=str(gid),
            label=f'Groupe {gid}',
            exists=gid in existing_g,
            sample_rows=sample[:5],
        )
        (known_g if ref.exists else new_g).append(ref)

    for ref in new_cp:
        issues.append(
            AnalysisIssue(
                level='warning',
                row=ref.sample_rows[0] if ref.sample_rows else None,
                column='id_cuve_principale',
                message=f'Nouveau site détecté : « {ref.key} ».',
                how_to_fix='Lancez create_rapport_entities pour le créer avant l’import des lignes.',
            )
        )
    for ref in new_cj:
        issues.append(
            AnalysisIssue(
                level='warning',
                row=ref.sample_rows[0] if ref.sample_rows else None,
                column='id_cuve_journaliere',
                message=f'Nouvelle cuve journalière détectée : « {ref.key} ».',
                how_to_fix='Lancez create_rapport_entities pour la créer avant l’import des lignes.',
            )
        )
    for ref in new_g:
        issues.append(
            AnalysisIssue(
                level='warning',
                row=ref.sample_rows[0] if ref.sample_rows else None,
                column='id_groupe',
                message=f'Nouveau groupe détecté : n°{ref.key}.',
                how_to_fix='Lancez create_rapport_entities pour le créer avant l’import des lignes.',
            )
        )

    hard_errors = [i for i in issues if i.level == 'error']
    return AnalysisResult(
        ok=len(hard_errors) == 0,
        row_count=len(rows),
        date_debut=date_debut.isoformat() if date_debut else None,
        date_fin=date_fin.isoformat() if date_fin else None,
        issues=issues,
        known_cuves_principales=known_cp,
        known_cuves_journalieres=known_cj,
        known_groupes=known_g,
        new_cuves_principales=new_cp,
        new_cuves_journalieres=new_cj,
        new_groupes=new_g,
        cj_links=cj_links,
    )


def analyze_rapport_file(path: str | Path) -> AnalysisResult:
    return analyze_rapport_rows(load_rapport_rows(path))


@transaction.atomic
def create_entities_from_analysis(
    analysis: AnalysisResult,
    *,
    default_cp_capacity: float = 10000.0,
    default_cj_capacity: float = 1000.0,
    default_groupe_marque: str = 'À préciser',
    default_groupe_puissance: str = 'À préciser',
) -> CreateResult:
    result = CreateResult()

    for ref in analysis.new_cuves_principales:
        if _lookup_cp(ref.key):
            result.skipped_existing.append(f'site:{ref.key}')
            continue
        CuvePrincipale.objects.create(
            identifiant=ref.key.strip(),
            capacite=default_cp_capacity,
        )
        result.created_cuves_principales.append(ref.key)

    for ref in analysis.new_groupes:
        gid = int(ref.key)
        if GroupeElectrogene.objects.filter(pk=gid).exists():
            result.skipped_existing.append(f'groupe:{gid}')
            continue
        identifiant = str(gid)
        if GroupeElectrogene.objects.filter(identifiant=identifiant).exists():
            identifiant = f'G#{gid}'
        GroupeElectrogene.objects.create(
            id=gid,
            identifiant=identifiant,
            compteur_horaire=0.0,
            marque=default_groupe_marque,
            puissance=default_groupe_puissance,
        )
        result.created_groupes.append(gid)

    for ref in analysis.new_cuves_journalieres:
        if _lookup_cj(ref.key):
            result.skipped_existing.append(f'cuve_journaliere:{ref.key}')
            continue
        link = analysis.cj_links.get(ref.key) or {}
        site_name = link.get('site')
        g_id = link.get('groupe_id')

        if site_name and not _lookup_cp(site_name):
            CuvePrincipale.objects.create(
                identifiant=site_name.strip(),
                capacite=default_cp_capacity,
            )
            if site_name not in result.created_cuves_principales:
                result.created_cuves_principales.append(site_name)

        cp = _lookup_cp(site_name) if site_name else None
        if not cp:
            raise ImportValidationError(
                f'Impossible de créer la cuve journalière « {ref.key} » : site manquant.',
                [
                    _friendly_error(
                        row=ref.sample_rows[0] if ref.sample_rows else None,
                        column='id_cuve_principale',
                        message=(
                            f'La cuve journalière « {ref.key} » nécessite un id_cuve_principale '
                            '(nom du site) sur la même ligne.'
                        ),
                        how_to_fix='Renseignez le nom du site comme sur la fiche de suivi.',
                    )
                ],
            )

        groupe = _lookup_groupe(g_id) if g_id is not None else None
        # OneToOne : détacher si le groupe est déjà lié ailleurs
        if groupe and hasattr(groupe, 'cuve_journaliere') and groupe.cuve_journaliere_id:
            other = groupe.cuve_journaliere
            if other.identifiant != ref.key:
                other.groupe_electrogene = None
                other.save(update_fields=['groupe_electrogene'])

        CuveJournaliere.objects.create(
            identifiant=ref.key.strip(),
            capacite=default_cj_capacity,
            cuve_principale=cp,
            groupe_electrogene=groupe,
        )
        result.created_cuves_journalieres.append(ref.key)

    return result


@transaction.atomic
def import_rapport_lignes(
    rows: list[dict],
    user=None,
    *,
    create_missing: bool = False,
    require_entities: bool = True,
) -> ImportResult:
    rows = [normalize_row_keys(r) for r in rows]
    analysis = analyze_rapport_rows(rows)
    if not analysis.ok:
        raise ImportValidationError(
            (
                'Il y a 1 point à corriger dans votre fichier.'
                if len(analysis.errors) == 1
                else f'Il y a {len(analysis.errors)} points à corriger dans votre fichier.'
            ),
            [
                {
                    'row': i.row,
                    'column': i.column,
                    'column_label': i.column,
                    'message': i.message,
                    'how_to_fix': i.how_to_fix,
                }
                for i in analysis.errors[:30]
            ],
        )

    created_entities = None
    if create_missing and (
        analysis.new_cuves_principales
        or analysis.new_cuves_journalieres
        or analysis.new_groupes
    ):
        created_entities = create_entities_from_analysis(analysis)
        analysis = analyze_rapport_rows(rows)

    if require_entities and (
        analysis.new_cuves_principales
        or analysis.new_cuves_journalieres
        or analysis.new_groupes
    ):
        missing_msgs = []
        for ref in analysis.new_cuves_principales:
            missing_msgs.append(
                _friendly_error(
                    row=ref.sample_rows[0] if ref.sample_rows else None,
                    column='id_cuve_principale',
                    message=f'Site inconnu : « {ref.key} ».',
                    how_to_fix='Exécutez : python manage.py create_rapport_entities <fichier>',
                )
            )
        for ref in analysis.new_cuves_journalieres:
            missing_msgs.append(
                _friendly_error(
                    row=ref.sample_rows[0] if ref.sample_rows else None,
                    column='id_cuve_journaliere',
                    message=f'Cuve journalière inconnue : « {ref.key} ».',
                    how_to_fix='Exécutez : python manage.py create_rapport_entities <fichier>',
                )
            )
        for ref in analysis.new_groupes:
            missing_msgs.append(
                _friendly_error(
                    row=ref.sample_rows[0] if ref.sample_rows else None,
                    column='id_groupe',
                    message=f'Groupe inconnu : n°{ref.key}.',
                    how_to_fix='Exécutez : python manage.py create_rapport_entities <fichier>',
                )
            )
        raise ImportValidationError(
            'Des sites / groupes du fichier n’existent pas encore en base.',
            missing_msgs[:30],
        )

    if not analysis.date_debut or not analysis.date_fin:
        raise ImportValidationError(
            'Les dates de période sont manquantes.',
            [
                _friendly_error(
                    row=2,
                    column='date_debut',
                    message='Impossible de lire la période du relevé.',
                    how_to_fix='Remplissez Date de début et Date de fin.',
                )
            ],
        )

    date_debut = date_cls.fromisoformat(analysis.date_debut)
    date_fin = date_cls.fromisoformat(analysis.date_fin)

    rapport = Rapport.objects.create(
        date_debut=date_debut,
        date_fin=date_fin,
        created_by=user if user is not None and getattr(user, 'pk', None) else None,
    )

    imported = 0
    for idx, row in enumerate(rows):
        excel_row = idx + 2
        cp_name = _to_name_or_none(row.get('id_cuve_principale'))
        cj_name = _to_name_or_none(row.get('id_cuve_journaliere'))
        g_id = _to_int_or_none(row.get('id_groupe'), row=excel_row, column='id_groupe')

        cp = _lookup_cp(cp_name)
        cj = _lookup_cj(cj_name)
        groupe = _lookup_groupe(g_id)

        LigneRapport.objects.create(
            rapport=rapport,
            cuve_principale=cp,
            cuve_journaliere=cj,
            groupe_electrogene=groupe,
            quantite_gasoil_cuve_principale=_to_float(
                row.get('quantités_cuve_principale'),
                row=excel_row,
                column='quantités_cuve_principale',
            ),
            quantite_gasoil_cuve_journaliere=_to_float(
                row.get('quantite_cuve_journaliere'),
                row=excel_row,
                column='quantite_cuve_journaliere',
            ),
            compteur_horaire=_to_float(
                row.get('compteur_horaire'),
                row=excel_row,
                column='compteur_horaire',
            ),
            depotage=_to_float(row.get('depotage'), row=excel_row, column='depotage'),
            etat_fonctionnement=str(row.get('état_fonctionnement') or 'F').strip() or 'F',
            observations=str(row.get('observations') or '').strip(),
        )
        imported += 1

    return ImportResult(
        rapport_id=rapport.id,
        imported_lines=imported,
        date_debut=analysis.date_debut,
        date_fin=analysis.date_fin,
        created_entities=created_entities,
    )


def import_rapport_file(
    path: str | Path,
    user=None,
    *,
    create_missing: bool = False,
    require_entities: bool = True,
) -> ImportResult:
    return import_rapport_lignes(
        load_rapport_rows(path),
        user=user,
        create_missing=create_missing,
        require_entities=require_entities,
    )
