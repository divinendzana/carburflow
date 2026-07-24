import csv
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
    Site,
)


class Command(BaseCommand):
    help = "Importation des données CSV de CarburFlow dans la base de données SQLite."

    def _read_rows(self, path):
        with path.open(mode='r', encoding='utf-8-sig', newline='') as f:
            sample = f.read(4096)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
                delimiter = dialect.delimiter
            except csv.Error:
                delimiter = ';' if ';' in sample else ','
            rows = list(csv.DictReader(f, delimiter=delimiter))
        return rows

    def _to_float(self, value):
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if text in {'', 'nan', 'None', 'null'}:
            return 0.0
        try:
            return float(text)
        except ValueError:
            return 0.0

    def _to_int(self, value, default=None):
        if value in (None, ''):
            return default
        try:
            return int(float(str(value).strip()))
        except (TypeError, ValueError):
            return default

    def _to_date(self, value):
        if not value:
            return None
        try:
            return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
        except ValueError:
            return None

    def _resolve_related(self, model_class, raw_value, id_field='id'):
        if raw_value in (None, ''):
            return None

        candidates = []
        try:
            numeric_value = int(float(str(raw_value).strip()))
            candidates.append(numeric_value)
        except (TypeError, ValueError):
            numeric_value = None

        if numeric_value is not None and model_class in {CuvePrincipale, CuveJournaliere, GroupeElectrogene}:
            candidates.append(numeric_value + 5000)

        for candidate in candidates:
            lookup = {id_field: str(candidate)} if id_field == 'identifiant' else {'pk': candidate}
            obj = model_class.objects.filter(**lookup).first()
            if obj is not None:
                return obj

        fallback_lookup = {id_field: str(raw_value)} if id_field == 'identifiant' else {'pk': raw_value}
        return model_class.objects.filter(**fallback_lookup).first()

    def add_arguments(self, parser):
        parser.add_argument(
            '--dir',
            type=str,
            default='data',
            help='Répertoire contenant les fichiers CSV (par défaut: "data")',
        )

    def handle(self, *args, **options):
        data_dir = Path(options['dir'])
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir

        self.stdout.write(self.style.NOTICE(f"Importation depuis : {data_dir}"))

        site_csv = data_dir / 'site.csv'
        if site_csv.exists():
            for row in self._read_rows(site_csv):
                site_id = self._to_int(row.get('id_site') or row.get('site_id'))
                if site_id is None:
                    continue
                Site.objects.update_or_create(
                    id=site_id,
                    defaults={
                        'nom_site': row.get('nom_site') or str(site_id),
                        'localisation': row.get('localisation', ''),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier site.csv importé"))

        cuve_p_csv = data_dir / 'cuve_principale.csv'
        if cuve_p_csv.exists():
            for row in self._read_rows(cuve_p_csv):
                cp_id = self._to_int(row.get('id_cuve_principale'))
                site_raw = row.get('id_site') or row.get('site_id') or row.get('site')
                if cp_id is None:
                    continue

                site_obj = None
                if site_raw not in (None, ''):
                    site_obj = Site.objects.filter(nom_site=str(site_raw)).first()
                    if site_obj is None:
                        site_obj, _ = Site.objects.get_or_create(
                            nom_site=str(site_raw),
                            defaults={'localisation': ''},
                        )

                CuvePrincipale.objects.update_or_create(
                    id=cp_id,
                    defaults={
                        'identifiant': str(cp_id),
                        'capacite': self._to_float(row.get('capcite') or row.get('capacite', 0.0)),
                        'site': site_obj,
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_principale.csv importé"))

        groupe_csv = data_dir / 'groupe_electrogene.csv'
        if groupe_csv.exists():
            for row in self._read_rows(groupe_csv):
                g_id = self._to_int(row.get('id') or row.get('id_groupe'))
                if g_id is None:
                    continue
                GroupeElectrogene.objects.update_or_create(
                    id=g_id,
                    defaults={
                        'identifiant': str(g_id),
                        'compteur_horaire': self._to_float(row.get('compteur_horaire') or row.get('compteur_horaire_groupe', 0.0)),
                        'marque': row.get('marque') or row.get('marque_groupe', ''),
                        'puissance': row.get('puissance') or row.get('puissance_groupe', ''),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier groupe_electrogene.csv importé"))

        cuve_j_csv = data_dir / 'cuve_journaliere.csv'
        if cuve_j_csv.exists():
            for row in self._read_rows(cuve_j_csv):
                cj_id = self._to_int(row.get('id_cuve_journaliere'))
                cp_id = self._to_int(row.get('id_cuve_principale'))
                if cj_id is None or cp_id is None:
                    continue
                CuveJournaliere.objects.update_or_create(
                    id=cj_id,
                    defaults={
                        'cuve_principale_id': cp_id,
                        'capacite': self._to_float(row.get('capacite', 0.0)),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_journaliere.csv importé"))

        link_csv = data_dir / 'cuve_journaliere_groupe.csv'
        if link_csv.exists():
            for row in self._read_rows(link_csv):
                cj_id = self._to_int(row.get('id_cuve_journaliere'))
                g_id = self._to_int(row.get('id_groupe'))
                if cj_id is None or g_id is None:
                    continue
                try:
                    cuve = CuveJournaliere.objects.get(id=cj_id)
                    groupe = GroupeElectrogene.objects.get(id=g_id)
                    cuve.groupe_electrogene = groupe
                    cuve.save(update_fields=['groupe_electrogene'])
                except (GroupeElectrogene.DoesNotExist, CuveJournaliere.DoesNotExist) as exc:
                    self.stdout.write(self.style.WARNING(f"Association ignorée CJ #{cj_id} ↔ Groupe #{g_id}: {exc}"))
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_journaliere_groupe.csv importé"))

        rapport_csv = data_dir / 'rapport.csv'
        if rapport_csv.exists():
            for row in self._read_rows(rapport_csv):
                r_id = self._to_int(row.get('id_rapport'))
                if r_id is None:
                    continue
                Rapport.objects.update_or_create(
                    id=r_id,
                    defaults={
                        'date_debut': self._to_date(row.get('date_debut')),
                        'date_fin': self._to_date(row.get('date_fin')),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier rapport.csv importé"))

        ligne_csv = data_dir / 'ligne_rapport.csv'
        if ligne_csv.exists():
            for row in self._read_rows(ligne_csv):
                l_id = self._to_int(row.get('id_ligne') or row.get('id'))
                r_id = self._to_int(row.get('id_rapport'))
                cp_raw = row.get('id_cuve_principale')
                cj_raw = row.get('id_cuve_journaliere')
                g_raw = row.get('id_groupe')
                if l_id is None or r_id is None:
                    continue

                cp_obj = self._resolve_related(CuvePrincipale, cp_raw, id_field='identifiant')
                cj_obj = self._resolve_related(CuveJournaliere, cj_raw)
                g_obj = self._resolve_related(GroupeElectrogene, g_raw)

                defaults = {
                    'rapport_id': r_id,
                    'cuve_principale_id': cp_obj.pk if cp_obj else None,
                    'cuve_journaliere_id': cj_obj.pk if cj_obj else None,
                    'groupe_electrogene_id': g_obj.pk if g_obj else None,
                    'quantite_gasoil_cuve_principale': self._to_float(row.get('quantite_gasoil_cuve_principale') or row.get('quantites_cuve_principale', 0.0)),
                    'quantite_gasoil_cuve_journaliere': self._to_float(row.get('quantite_gasoil_cuve_journaliere') or row.get('quantite_cuve_journaliere', 0.0)),
                    'compteur_horaire': self._to_float(row.get('compteur_horaire', 0.0)),
                    'depotage': self._to_float(row.get('depotage', 0.0)),
                    'etat_fonctionnement': row.get('etat_fonctionnement') or row.get('etat_fonctionnement_', 'F'),
                    'observations': row.get('observations', ''),
                }
                try:
                    LigneRapport.objects.update_or_create(id=l_id, defaults=defaults)
                except IntegrityError as exc:
                    self.stdout.write(self.style.WARNING(
                        f"ligne_rapport #{l_id} ignorée: {exc}"
                    ))
            self.stdout.write(self.style.SUCCESS("✔ Fichier ligne_rapport.csv importé"))

        self.stdout.write(self.style.SUCCESS("🎉 Importation globale des CSV terminée avec succès !"))
