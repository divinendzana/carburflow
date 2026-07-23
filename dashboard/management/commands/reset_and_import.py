from pathlib import Path

from django.core.management import call_command
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
    help = "Vider la base de données puis importer toutes les données CSV depuis le dossier data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dir',
            type=str,
            default='data',
            help='Répertoire contenant les fichiers CSV (par défaut: "data")',
        )
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='Ne pas demander de confirmation avant la réinitialisation.',
        )

    def handle(self, *args, **options):
        data_dir = Path(options['dir'])
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir

        if not options['noinput']:
            confirm = input(
                "Cette action va supprimer toutes les données de la base et les recharger depuis "
                f"{data_dir}. Continuer ? [y/N] "
            )
            if confirm.strip().lower() not in {'y', 'yes', 'o', 'oui'}:
                self.stdout.write(self.style.WARNING('Opération annulée.'))
                return

        self.stdout.write(self.style.WARNING('Suppression des données existantes...'))

        # Nettoyage par ordre de dépendances pour éviter les contraintes liées.
        LigneRapport.objects.all().delete()
        Rapport.objects.all().delete()
        GroupeElectrogene.objects.all().delete()
        CuveJournaliere.objects.all().delete()
        CuvePrincipale.objects.all().delete()
        Site.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('✔ Données supprimées'))

        self.stdout.write(self.style.NOTICE(f'Importation depuis : {data_dir}'))
        call_command('import_csv', dir=str(data_dir), stdout=self.stdout, stderr=self.stderr)
        self.stdout.write(self.style.SUCCESS('🎉 Réinitialisation et importation terminés avec succès !'))
