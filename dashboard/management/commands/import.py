import csv
import io
import re
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
            text = str(value).strip()
            if text.startswith('cp'):
                return None
            if text.startswith('cj'):
                return None
            if text.startswith('g'):
                return None
            if text.startswith('r'):
                return None
            return int(float(text))
        except (TypeError, ValueError):
            return default

    def _read_csv_rows(self, path):
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

    def _get_column(self, row, *candidates):
        for candidate in candidates:
            if candidate in row and row.get(candidate) not in (None, ''):
                return row.get(candidate)
        return None

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

        text = str(raw_value).strip()
        candidates = []
        if text:
            try:
                numeric_value = int(float(text))
                candidates.append(numeric_value)
            except (TypeError, ValueError):
                numeric_value = None

            if numeric_value is not None and model_class in {CuvePrincipale, CuveJournaliere, GroupeElectrogene}:
                candidates.append(numeric_value + 5000)

            if model_class is CuvePrincipale:
                candidates.append(text)
            elif model_class is CuveJournaliere:
                candidates.append(text)
            elif model_class is GroupeElectrogene:
                candidates.append(text)

        for candidate in candidates:
            if model_class is CuvePrincipale:
                obj = model_class.objects.filter(identifiant=str(candidate)).first()
                if obj is not None:
                    return obj
                obj = model_class.objects.filter(pk=candidate).first()
                if obj is not None:
                    return obj
            elif model_class is CuveJournaliere:
                obj = model_class.objects.filter(pk=candidate).first()
                if obj is not None:
                    return obj
            elif model_class is GroupeElectrogene:
                obj = model_class.objects.filter(identifiant=str(candidate)).first()
                if obj is not None:
                    return obj
                obj = model_class.objects.filter(pk=candidate).first()
                if obj is not None:
                    return obj

        return None

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

        cuve_p_csv = data_dir / 'cuve_principale.csv'
        if cuve_p_csv.exists():
            rows = self._read_csv_rows(cuve_p_csv)
            for row in rows:
                cp_id = self._to_int(self._get_column(row, 'id_cuve_principale', 'id', 'id_cuve'))
                if cp_id is None:
                    cp_id = self._to_int(self._get_column(row, 'id', 'id_cuve_principale'))
                if cp_id is None:
                    continue
                CuvePrincipale.objects.update_or_create(
                    id=cp_id,
                    defaults={
                        'identifiant': str(self._get_column(row, 'id_cuve_principale', 'id', 'id_cuve') or cp_id),
                        'capacite': self._to_float(self._get_column(row, 'capacite', 'capcite', 'capacité', 'capacity')),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_principale.csv importé"))

        groupe_csv = data_dir / 'groupe_electrogene.csv'
        if groupe_csv.exists():
            rows = self._read_csv_rows(groupe_csv)
            for row in rows:
                g_id = self._to_int(self._get_column(row, 'id_groupe', 'id', 'id_groupe_electrogene'))
                if g_id is None:
                    continue
                GroupeElectrogene.objects.update_or_create(
                    id=g_id,
                    defaults={
                        'identifiant': str(g_id),
                        'compteur_horaire': self._to_float(self._get_column(row, 'compteur_horaire_groupe', 'compteur_horaire', 'compteur_horaire_groupe_electrogene')),
                        'marque': self._get_column(row, 'marque_groupe', 'marque', 'marque_groupe_electrogene') or '',
                        'puissance': self._get_column(row, 'puissance_groupe', 'puissance', 'puissance_groupe_electrogene') or '',
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier groupe_electrogene.csv importé"))

        cuve_j_csv = data_dir / 'cuve_journaliere.csv'
        if cuve_j_csv.exists():
            rows = self._read_csv_rows(cuve_j_csv)
            for row in rows:
                cj_id = self._to_int(self._get_column(row, 'id_cuve_journaliere', 'id', 'id_cuve'))
                cp_id = self._to_int(self._get_column(row, 'id_cuve_principale', 'id_cuve_principale_csv', 'id_cuve_principale_associe'))
                if cj_id is None or cp_id is None:
                    continue
                CuveJournaliere.objects.update_or_create(
                    id=cj_id,
                    defaults={
                        'cuve_principale_id': cp_id,
                        'capacite': self._to_float(self._get_column(row, 'capacite', 'capcite', 'capacity')),
                    },
                )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_journaliere.csv importé"))

        link_csv = data_dir / 'cuve_journaliere_groupe.csv'
        if link_csv.exists():
            rows = self._read_csv_rows(link_csv)
            for row in rows:
                cj_id = self._to_int(self._get_column(row, 'id_cuve_journaliere', 'id_cuve', 'cj_id'))
                g_id = self._to_int(self._get_column(row, 'id_groupe', 'groupe_id', 'id_groupe_electrogene'))
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
            rows = self._read_csv_rows(rapport_csv)
            report_aliases = {}
            report_index = 1
            for row in rows:
                raw_r_id = self._get_column(row, 'id_rapport', 'id', 'rapport_id')
                r_id = self._to_int(raw_r_id)
                if r_id is None:
                    continue
                report_obj = Rapport.objects.update_or_create(
                    id=r_id,
                    defaults={
                        'date_debut': self._to_date(self._get_column(row, 'date_debut', 'date_debut_rapport')),
                        'date_fin': self._to_date(self._get_column(row, 'date_fin', 'date_fin_rapport')),
                    },
                )[0]
                report_aliases[str(raw_r_id)] = report_obj.id
                report_aliases[str(report_index)] = report_obj.id
                report_index += 1
            self.stdout.write(self.style.SUCCESS("✔ Fichier rapport.csv importé"))
        else:
            report_aliases = {}

        ligne_csv = data_dir / 'ligne_rapport.csv'
        if ligne_csv.exists():
            rows = self._read_csv_rows(ligne_csv)
            for row in rows:
                l_id = self._to_int(self._get_column(row, 'id_ligne', 'id', 'ligne_id'))
                raw_report_id = self._get_column(row, 'id_rapport', 'rapport_id', 'id_rapport_csv')
                cp_raw = self._get_column(row, 'id_cuve_principale', 'id_cuve', 'id_cuve_principale_associe')
                cj_raw = self._get_column(row, 'id_cuve_journaliere', 'id_cuve_journaliere_associe', 'id_cj')
                g_raw = self._get_column(row, 'id_groupe', 'id_groupe_electrogene', 'groupe_id')
                if l_id is None:
                    continue

                rapport_id = None
                if raw_report_id not in (None, ''):
                    for candidate in [str(raw_report_id), str(self._to_int(raw_report_id))]:
                        if candidate in report_aliases:
                            rapport_id = report_aliases[candidate]
                            break
                if rapport_id is None:
                    rapport_id = self._to_int(raw_report_id)

                cp_obj = self._resolve_related(CuvePrincipale, cp_raw, id_field='identifiant')
                cj_obj = self._resolve_related(CuveJournaliere, cj_raw)
                g_obj = self._resolve_related(GroupeElectrogene, g_raw)

                defaults = {
                    'rapport_id': rapport_id,
                    'cuve_principale_id': cp_obj.pk if cp_obj else None,
                    'cuve_journaliere_id': cj_obj.pk if cj_obj else None,
                    'groupe_electrogene_id': g_obj.pk if g_obj else None,
                    'quantite_gasoil_cuve_principale': self._to_float(self._get_column(row, 'quantite_gasoil_cuve_principale', 'quantités_cuve_principale', 'quantite_cuve_principale', 'qte_gasoil_cuve_principale')),
                    'quantite_gasoil_cuve_journaliere': self._to_float(self._get_column(row, 'quantite_gasoil_cuve_journaliere', 'quantite_cuve_journaliere', 'qte_gasoil_cuve_journaliere')),
                    'compteur_horaire': self._to_float(self._get_column(row, 'compteur_horaire', 'compteur_horaire_groupe', 'compteur_horaire_ligne')),
                    'depotage': self._to_float(self._get_column(row, 'depotage', 'depotage_gasoil', 'depotage_ligne')),
                    'etat_fonctionnement': self._get_column(row, 'etat_fonctionnement', 'état_fonctionnement', 'etat') or 'F',
                    'observations': self._get_column(row, 'observations', 'observation', 'obs') or '',
                }
                try:
                    LigneRapport.objects.update_or_create(id=l_id, defaults=defaults)
                except IntegrityError as exc:
                    self.stdout.write(self.style.WARNING(f"ligne_rapport #{l_id} ignorée: {exc}"))
            self.stdout.write(self.style.SUCCESS("✔ Fichier ligne_rapport.csv importé"))

        self.stdout.write(self.style.SUCCESS("🎉 Importation globale des CSV terminée avec succès !"))
