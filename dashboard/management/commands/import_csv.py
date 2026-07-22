import csv
from pathlib import Path
from django.core.management.base import BaseCommand
from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)


class Command(BaseCommand):
    help = "Importation des données CSV de CarburFlow dans la base de données SQLite."

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

        # 1. Import Site (site.csv)
        site_csv = data_dir / 'site.csv'
        if site_csv.exists():
            with open(site_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    site_id = int(row['id_site']) if 'id_site' in row and row['id_site'] else None
                    Site.objects.update_or_create(
                        id=site_id,
                        defaults={
                            'nom_site': row.get('nom_site', ''),
                            'localisation': row.get('localisation', ''),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier site.csv importé"))

        # 2. Import CuvePrincipale (cuve_principale.csv)
        cuve_p_csv = data_dir / 'cuve_principale.csv'
        if cuve_p_csv.exists():
            with open(cuve_p_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cp_id = int(row['id_cuve_principale']) if 'id_cuve_principale' in row and row['id_cuve_principale'] else None
                    site_id = int(row['id_site'])
                    CuvePrincipale.objects.update_or_create(
                        id=cp_id,
                        defaults={
                            'site_id': site_id,
                            'capacite': float(row.get('capacite', 0.0)),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_principale.csv importé"))

        # 3. Import CuveJournaliere (cuve_journaliere.csv)
        cuve_j_csv = data_dir / 'cuve_journaliere.csv'
        if cuve_j_csv.exists():
            with open(cuve_j_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cj_id = int(row['id_cuve_journaliere']) if 'id_cuve_journaliere' in row and row['id_cuve_journaliere'] else None
                    cp_id = int(row['id_cuve_principale'])
                    CuveJournaliere.objects.update_or_create(
                        id=cj_id,
                        defaults={
                            'cuve_principale_id': cp_id,
                            'capacite': float(row.get('capacite', 0.0)),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_journaliere.csv importé"))

        # 4. Import GroupeElectrogene (groupe_electrogene.csv)
        groupe_csv = data_dir / 'groupe_electrogene.csv'
        if groupe_csv.exists():
            with open(groupe_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    g_id = int(row['id']) if 'id' in row and row['id'] else None
                    GroupeElectrogene.objects.update_or_create(
                        id=g_id,
                        defaults={
                            'compteur_horaire': float(row.get('compteur_horaire', 0.0)),
                            'consommation_horaire': float(row.get('consommation_horaire', 0.0)),
                            'marque': row.get('marque', ''),
                            'puissance': row.get('puissance', ''),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier groupe_electrogene.csv importé"))

        # 5. Import Link CuveJournaliere ↔ Groupe (cuve_journaliere_groupe.csv)
        link_csv = data_dir / 'cuve_journaliere_groupe.csv'
        if link_csv.exists():
            with open(link_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cj_id = int(row['id_cuve_journaliere'])
                    g_id = int(row['id_groupe'])
                    try:
                        cj = CuveJournaliere.objects.get(id=cj_id)
                        g = GroupeElectrogene.objects.get(id=g_id)
                        g.cuves_journalieres.add(cj)
                    except (CuveJournaliere.DoesNotExist, GroupeElectrogene.DoesNotExist) as e:
                        self.stdout.write(self.style.WARNING(f"Erreur d'association CJ #{cj_id} ↔ Groupe #{g_id}: {e}"))
            self.stdout.write(self.style.SUCCESS("✔ Fichier cuve_journaliere_groupe.csv importé"))

        # 6. Import Rapport (rapport.csv)
        rapport_csv = data_dir / 'rapport.csv'
        if rapport_csv.exists():
            with open(rapport_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    r_id = int(row['id_rapport']) if 'id_rapport' in row and row['id_rapport'] else None
                    Rapport.objects.update_or_create(
                        id=r_id,
                        defaults={
                            'date_debut': row.get('date_debut'),
                            'date_fin': row.get('date_fin'),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier rapport.csv importé"))

        # 7. Import LigneRapport (ligne_rapport.csv)
        ligne_csv = data_dir / 'ligne_rapport.csv'
        if ligne_csv.exists():
            with open(ligne_csv, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    l_id = int(row['id_ligne']) if 'id_ligne' in row and row['id_ligne'] else None
                    r_id = int(row['id_rapport'])
                    cp_id = int(row['id_cuve_principale']) if row.get('id_cuve_principale') else None
                    cj_id = int(row['id_cuve_journaliere']) if row.get('id_cuve_journaliere') else None
                    g_id = int(row['id_groupe']) if row.get('id_groupe') else None

                    LigneRapport.objects.update_or_create(
                        id=l_id,
                        defaults={
                            'rapport_id': r_id,
                            'cuve_principale_id': cp_id,
                            'cuve_journaliere_id': cj_id,
                            'groupe_id': g_id,
                            'quantite_gasoil_cuve_principale': float(row.get('quantite_gasoil_cuve_principale', 0.0)),
                            'quantite_gasoil_cuve_journaliere': float(row.get('quantite_gasoil_cuve_journaliere', 0.0)),
                            'compteur_horaire': float(row.get('compteur_horaire', 0.0)),
                            'depotage': float(row.get('depotage', 0.0)),
                            'etat_fonctionnement': row.get('etat_fonctionnement', 'F'),
                            'observations': row.get('observations', ''),
                        },
                    )
            self.stdout.write(self.style.SUCCESS("✔ Fichier ligne_rapport.csv importé"))

        self.stdout.write(self.style.SUCCESS("🎉 Importation globale des CSV terminée avec succès !"))
