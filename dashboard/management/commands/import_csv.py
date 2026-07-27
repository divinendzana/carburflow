"""
Importe les données de référence (cuves, groupes) puis les rapports rapport_*_carburflow.csv.

Usage :
  python manage.py import_csv
  python manage.py import_csv --dir data
  python manage.py import_csv --user admin
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError

from dashboard.models import (
    CuveJournaliere,
    CuvePrincipale,
    GroupeElectrogene,
    LigneRapport,
    Rapport,
)
from dashboard.norme import ImportValidationError
from dashboard.rapport_pipeline import _extract_groupe_id, import_rapport_file


class Command(BaseCommand):
    help = (
        'Importe cuve_principale, groupe_electrogene, cuve_journaliere, '
        'cuve_journaliere_groupe puis rapport_*_carburflow.csv.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dir',
            type=str,
            default='data',
            help='Répertoire contenant les fichiers CSV (défaut : data)',
        )
        parser.add_argument(
            '--user',
            type=str,
            default='',
            help='Username à associer comme importateur des rapports (created_by)',
        )
        parser.add_argument(
            '--skip-reports',
            action='store_true',
            help='Importer uniquement les entités de référence (sans les rapports)',
        )

    def handle(self, *args, **options):
        data_dir = Path(options['dir'])
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir

        if not data_dir.is_dir():
            raise CommandError(f'Répertoire introuvable : {data_dir}')

        user = None
        username = (options.get('user') or '').strip()
        if username:
            User = get_user_model()
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise CommandError(f'Utilisateur introuvable : {username}') from exc

        self.stdout.write(self.style.NOTICE(f'Importation depuis : {data_dir}'))

        cp_by_name = self._import_cuves_principales(data_dir / 'cuve_principale.csv')
        self._import_groupes(data_dir / 'groupe_electrogene.csv')
        cj_by_name = self._import_cuves_journalieres(data_dir / 'cuve_journaliere.csv', cp_by_name)
        self._import_lien_cj_groupe(data_dir / 'cuve_journaliere_groupe.csv', cj_by_name)

        if not options['skip_reports']:
            self._import_rapports_carburflow(data_dir, user)

        self.stdout.write(self.style.SUCCESS('Import CSV terminé avec succès.'))

    # ── Utilitaires ──────────────────────────────────────────────────────────

    def _to_float(self, value):
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip().replace(',', '.')
        if text in {'', 'nan', 'None', 'null'}:
            return 0.0
        try:
            return float(text)
        except ValueError:
            return 0.0

    def _get_column(self, row, *candidates):
        for candidate in candidates:
            if candidate in row and row.get(candidate) not in (None, ''):
                return row.get(candidate)
        return None

    def _read_csv_rows(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        raw_bytes = path.read_bytes()

        if raw_bytes.startswith(b'\xff\xfe') or raw_bytes.startswith(b'\xfe\xff'):
            text = raw_bytes.decode('utf-16')
        else:
            text = raw_bytes.decode('utf-8-sig')

        text = text.replace('\r\n', '\n').replace('\r', '\n')
        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            return []

        first_line = lines[0]
        for delimiter in ['\t', ';', ',']:
            if delimiter in first_line:
                return list(csv.DictReader(io.StringIO(text), delimiter=delimiter))
        return list(csv.DictReader(io.StringIO(text), delimiter=','))

    def _lookup_groupe(self, raw_id: str | None) -> GroupeElectrogene | None:
        if not raw_id:
            return None
        text = str(raw_id).strip()
        obj = GroupeElectrogene.objects.filter(identifiant__iexact=text).first()
        if obj:
            return obj
        gid = _extract_groupe_id(text)
        if gid is not None:
            return GroupeElectrogene.objects.filter(pk=gid).first()
        return None

    # ── Importateurs ─────────────────────────────────────────────────────────

    def _import_cuves_principales(self, path: Path) -> dict[str, int]:
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f'Fichier absent ou vide : {path.name}'))
            return {}

        cp_by_name: dict[str, int] = {}
        count = 0
        for row in rows:
            name = self._get_column(row, 'id_cuve_principale')
            if not name:
                continue
            name = name.strip()
            obj, _ = CuvePrincipale.objects.update_or_create(
                identifiant=name,
                defaults={
                    'capacite': self._to_float(self._get_column(row, 'capcite', 'capacite')),
                },
            )
            cp_by_name[name] = obj.pk
            count += 1
        self.stdout.write(self.style.SUCCESS(f'cuve_principale.csv — {count} site(s)'))
        return cp_by_name

    def _import_groupes(self, path: Path) -> None:
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f'Fichier absent ou vide : {path.name}'))
            return

        count = 0
        for row in rows:
            raw_id = self._get_column(row, 'id_groupe')
            if not raw_id:
                continue
            identifiant = str(raw_id).strip()
            gid = _extract_groupe_id(identifiant)
            defaults = {
                'identifiant': identifiant,
                'marque': self._get_column(row, 'marque_groupe') or '',
                'puissance': str(self._get_column(row, 'puissance_groupe') or ''),
            }
            if gid is not None:
                GroupeElectrogene.objects.update_or_create(pk=gid, defaults=defaults)
            else:
                GroupeElectrogene.objects.update_or_create(identifiant=identifiant, defaults=defaults)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'groupe_electrogene.csv — {count} groupe(s)'))

    def _import_cuves_journalieres(self, path: Path, cp_by_name: dict[str, int]) -> dict[str, int]:
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f'Fichier absent ou vide : {path.name}'))
            return {}

        cj_by_name: dict[str, int] = {}
        count = 0
        for row in rows:
            name = self._get_column(row, 'id_cuve_journaliere')
            cp_name = self._get_column(row, 'id_cuve_principale')
            if not name or not cp_name:
                continue
            name, cp_name = name.strip(), cp_name.strip()
            cp_id = cp_by_name.get(cp_name)
            if cp_id is None:
                cp = CuvePrincipale.objects.filter(identifiant__iexact=cp_name).first()
                if cp:
                    cp_id = cp.pk
                    cp_by_name[cp_name] = cp_id
            if cp_id is None:
                cp, created = CuvePrincipale.objects.update_or_create(
                    identifiant=cp_name,
                    defaults={
                        'capacite': self._to_float(self._get_column(row, 'capacite')) or 1000.0,
                    },
                )
                cp_id = cp.pk
                cp_by_name[cp_name] = cp_id
                if created:
                    self.stdout.write(
                        self.style.WARNING(f'  Site créé automatiquement : {cp_name}')
                    )

            obj, _ = CuveJournaliere.objects.update_or_create(
                identifiant=name,
                defaults={
                    'cuve_principale_id': cp_id,
                    'capacite': self._to_float(self._get_column(row, 'capacite')),
                },
            )
            cj_by_name[name] = obj.pk
            count += 1
        self.stdout.write(self.style.SUCCESS(f'cuve_journaliere.csv — {count} cuve(s) journalière(s)'))
        return cj_by_name

    def _import_lien_cj_groupe(self, path: Path, cj_by_name: dict[str, int]) -> None:
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f'Fichier absent ou vide : {path.name}'))
            return

        count = 0
        for row in rows:
            cj_name = self._get_column(row, 'id_cuve_journaliere')
            raw_groupe = self._get_column(row, 'id_groupe')
            if not cj_name or not raw_groupe:
                continue
            cj_name = cj_name.strip()
            cj_id = cj_by_name.get(cj_name)
            if cj_id is None:
                cj = CuveJournaliere.objects.filter(identifiant__iexact=cj_name).first()
                cj_id = cj.pk if cj else None
            if cj_id is None:
                self.stdout.write(self.style.WARNING(f'  Cuve journalière inconnue : {cj_name}'))
                continue

            groupe = self._lookup_groupe(raw_groupe)
            if groupe is None:
                self.stdout.write(
                    self.style.WARNING(f'  Groupe inconnu : {raw_groupe} (cuve « {cj_name} »)')
                )
                continue

            try:
                cuve = CuveJournaliere.objects.get(pk=cj_id)
                cuve.groupe_electrogene = groupe
                cuve.save(update_fields=['groupe_electrogene'])
                count += 1
            except IntegrityError as exc:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Association ignorée CJ « {cj_name} » ↔ {groupe.identifiant} : {exc}'
                    )
                )
        self.stdout.write(self.style.SUCCESS(f'cuve_journaliere_groupe.csv — {count} liaison(s)'))

    def _import_rapports_carburflow(self, data_dir: Path, user) -> None:
        rapport_files = sorted(data_dir.glob('rapport_*_carburflow.csv'))
        if not rapport_files:
            self.stdout.write(
                self.style.WARNING('Aucun fichier rapport_*_carburflow.csv trouvé.')
            )
            return

        total_lines = 0
        for path in rapport_files:
            try:
                result = import_rapport_file(path, user=user)
            except ImportValidationError as exc:
                raise CommandError(f'{path.name} : {exc.message}') from exc

            self.stdout.write(
                self.style.SUCCESS(
                    f'{path.name} — rapport #{result.rapport_id}, '
                    f'{result.imported_lines} ligne(s) '
                    f'({result.date_debut} → {result.date_fin})'
                )
            )
            total_lines += result.imported_lines

        self.stdout.write(
            self.style.SUCCESS(
                f'{len(rapport_files)} rapport(s), {total_lines} ligne(s) au total'
            )
        )
