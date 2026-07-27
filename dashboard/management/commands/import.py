import csv
import io
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import IntegrityError

from dashboard.models import (
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)


class Command(BaseCommand):
    help = "Importation des données CSV de CarburFlow dans la base de données SQLite."

    # ──────────────────────────────────────────────────────────────────────────
    # Utilitaires
    # ──────────────────────────────────────────────────────────────────────────

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

    def _to_int(self, value, default=None):
        if value in (None, ''):
            return default
        text = str(value).strip()
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return default

    def _to_date(self, value):
        if not value:
            return None
        try:
            return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
        except ValueError:
            return None

    def _get_column(self, row, *candidates):
        """Retourne la première valeur non-vide parmi les noms de colonnes candidats."""
        for candidate in candidates:
            if candidate in row and row.get(candidate) not in (None, ''):
                return row.get(candidate)
        return None

    def _read_csv_rows(self, path):
        """Lit un fichier CSV (UTF-8, UTF-8-BOM ou UTF-16) et retourne une liste de dicts."""
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

    # ──────────────────────────────────────────────────────────────────────────
    # Arguments
    # ──────────────────────────────────────────────────────────────────────────

    def add_arguments(self, parser):
        parser.add_argument(
            '--dir',
            type=str,
            default='data',
            help='Répertoire contenant les fichiers CSV (par défaut: "data")',
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Entrée principale
    # ──────────────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        data_dir = Path(options['dir'])
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir

        self.stdout.write(self.style.NOTICE(f"Importation depuis : {data_dir}"))

        cp_by_name = self._import_cuves_principales(data_dir / 'cuve_principale.csv')
        self._import_groupes(data_dir / 'groupe_electrogene.csv')
        cj_by_name = self._import_cuves_journalieres(data_dir / 'cuve_journaliere.csv', cp_by_name)
        self._import_lien_cj_groupe(data_dir / 'cuve_journaliere_groupe.csv', cj_by_name)
        report_aliases = self._import_rapports(data_dir / 'rapport.csv')
        self._import_lignes(data_dir / 'ligne_rapport.csv', report_aliases, cp_by_name, cj_by_name)

        self.stdout.write(self.style.SUCCESS("🎉 Importation globale des CSV terminée avec succès !"))

    # ──────────────────────────────────────────────────────────────────────────
    # Importateurs par entité
    # ──────────────────────────────────────────────────────────────────────────

    def _import_cuves_principales(self, path):
        """
        CSV attendu : id_cuve_principale, capcite
        id_cuve_principale est le nom réel du site (ex. "BEPANDA INTERNATIONAL"),
        utilisé comme identifiant métier (champ `identifiant`).
        Retourne un dict {nom_site: pk} pour les imports suivants.
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return {}

        cp_by_name = {}
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
        self.stdout.write(self.style.SUCCESS(f"✔ cuve_principale.csv — {count} lignes importées"))
        return cp_by_name

    def _import_groupes(self, path):
        """
        CSV attendu : id_groupe;marque_groupe;puissance_groupe;compteur_horaire_groupe
        Délimiteur  : point-virgule
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return

        count = 0
        for row in rows:
            g_id = self._to_int(self._get_column(row, 'id_groupe'))
            if g_id is None:
                continue
            GroupeElectrogene.objects.update_or_create(
                id=g_id,
                defaults={
                    'identifiant': str(g_id),
                    'marque': self._get_column(row, 'marque_groupe') or '',
                    'puissance': str(self._get_column(row, 'puissance_groupe') or ''),
                    'compteur_horaire': self._to_float(self._get_column(row, 'compteur_horaire_groupe')),
                },
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"✔ groupe_electrogene.csv — {count} lignes importées"))

    def _import_cuves_journalieres(self, path, cp_by_name):
        """
        CSV attendu : id_cuve_journaliere, id_cuve_principale, capacite
        id_cuve_journaliere est le nom réel de la cuve journalière sur le terrain
        (ex. "CT BONABERI 1"). Ce modèle n'a pas de champ identifiant propre : la
        correspondance nom → pk est conservée en mémoire (dict) pour les imports
        suivants (cuve_journaliere_groupe.csv, ligne_rapport.csv).
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return {}

        cj_by_name = {}
        count = 0
        for cj_id, row in enumerate(rows, start=1):
            name = self._get_column(row, 'id_cuve_journaliere')
            cp_name = self._get_column(row, 'id_cuve_principale')
            if not name or not cp_name:
                continue
            name, cp_name = name.strip(), cp_name.strip()
            cp_id = cp_by_name.get(cp_name)
            if cp_id is None:
                self.stdout.write(
                    self.style.WARNING(f"  ↳ Cuve principale inconnue pour « {name} » : {cp_name}")
                )
                continue
            CuveJournaliere.objects.update_or_create(
                id=cj_id,
                defaults={
                    'identifiant': name,
                    'cuve_principale_id': cp_id,
                    'capacite': self._to_float(self._get_column(row, 'capacite')),
                },
            )
            cj_by_name[name] = cj_id
            count += 1
        self.stdout.write(self.style.SUCCESS(f"✔ cuve_journaliere.csv — {count} lignes importées"))
        return cj_by_name

    def _import_lien_cj_groupe(self, path, cj_by_name):
        """
        CSV attendu : id_cuve_journaliere, id_groupe
        Lie chaque CuveJournaliere (résolue par nom) à son GroupeElectrogene (OneToOne).
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return

        count = 0
        for row in rows:
            cj_name = self._get_column(row, 'id_cuve_journaliere')
            g_id = self._to_int(self._get_column(row, 'id_groupe'))
            if not cj_name or g_id is None:
                continue
            cj_id = cj_by_name.get(cj_name.strip())
            if cj_id is None:
                self.stdout.write(self.style.WARNING(f"  ↳ Cuve journalière inconnue : {cj_name}"))
                continue
            try:
                cuve = CuveJournaliere.objects.get(id=cj_id)
                groupe = GroupeElectrogene.objects.get(id=g_id)
                cuve.groupe_electrogene = groupe
                cuve.save(update_fields=['groupe_electrogene'])
                count += 1
            except GroupeElectrogene.DoesNotExist as exc:
                self.stdout.write(
                    self.style.WARNING(f"  ↳ Association ignorée CJ « {cj_name} » ↔ Groupe #{g_id} : {exc}")
                )
        self.stdout.write(self.style.SUCCESS(f"✔ cuve_journaliere_groupe.csv — {count} associations établies"))

    def _import_rapports(self, path):
        """
        CSV attendu : id_rapport, date_debut, date_fin
        Retourne un dict {str(id_csv): db_id} pour les lignes de rapport.
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return {}

        aliases = {}
        count = 0
        for row in rows:
            raw_id = self._get_column(row, 'id_rapport')
            r_id = self._to_int(raw_id)
            if r_id is None:
                continue
            obj, _ = Rapport.objects.update_or_create(
                id=r_id,
                defaults={
                    'date_debut': self._to_date(self._get_column(row, 'date_debut')),
                    'date_fin': self._to_date(self._get_column(row, 'date_fin')),
                },
            )
            aliases[str(raw_id)] = obj.id
            count += 1
        self.stdout.write(self.style.SUCCESS(f"✔ rapport.csv — {count} rapports importés"))
        return aliases

    def _import_lignes(self, path, report_aliases, cp_by_name, cj_by_name):
        """
        CSV attendu :
          id_ligne, id_rapport, id_cuve_principale, id_cuve_journaliere, id_groupe,
          quantités_cuve_principale, quantite_cuve_journaliere,
          depotage, compteur_horaire, état_fonctionnement, observations
        id_cuve_principale et id_cuve_journaliere sont des noms de terrain,
        résolus via les dicts construits lors des imports précédents.
        """
        rows = self._read_csv_rows(path)
        if not rows:
            self.stdout.write(self.style.WARNING(f"⚠ Fichier absent ou vide : {path.name}"))
            return

        count = 0
        skipped = 0
        for row in rows:
            l_id = self._to_int(self._get_column(row, 'id_ligne'))
            if l_id is None:
                skipped += 1
                continue

            raw_r = self._get_column(row, 'id_rapport')
            rapport_id = report_aliases.get(str(raw_r))

            cp_name = self._get_column(row, 'id_cuve_principale')
            cj_name = self._get_column(row, 'id_cuve_journaliere')
            cp_id = cp_by_name.get(cp_name.strip()) if cp_name else None
            cj_id = cj_by_name.get(cj_name.strip()) if cj_name else None
            g_id = self._to_int(self._get_column(row, 'id_groupe'))

            defaults = {
                'rapport_id': rapport_id,
                'cuve_principale_id': cp_id,
                'cuve_journaliere_id': cj_id,
                'groupe_electrogene_id': g_id,
                'quantite_gasoil_cuve_principale': self._to_float(
                    self._get_column(row, 'quantités_cuve_principale', 'quantite_cuve_principale')
                ),
                'quantite_gasoil_cuve_journaliere': self._to_float(
                    self._get_column(row, 'quantite_cuve_journaliere')
                ),
                'depotage': self._to_float(self._get_column(row, 'depotage')),
                'compteur_horaire': self._to_float(self._get_column(row, 'compteur_horaire')),
                'etat_fonctionnement': self._get_column(row, 'état_fonctionnement', 'etat_fonctionnement') or 'F',
                'observations': self._get_column(row, 'observations') or '',
            }

            try:
                LigneRapport.objects.update_or_create(id=l_id, defaults=defaults)
                count += 1
            except IntegrityError as exc:
                self.stdout.write(self.style.WARNING(f"  ↳ ligne_rapport #{l_id} ignorée : {exc}"))
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(f"✔ ligne_rapport.csv — {count} lignes importées, {skipped} ignorées")
        )