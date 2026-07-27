"""
Seed complet : comptes démo + données CSV (cuves, groupes, rapports).

Usage :
  python manage.py seed
  python manage.py seed --dir data --noinput
  python manage.py seed --reset   # vide les données métier avant import
"""

from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand

from dashboard.models import (
    CuveJournaliere,
    CuvePrincipale,
    GroupeElectrogene,
    LigneRapport,
    Rapport,
)
from dashboard.sequence_utils import reset_sqlite_sequences


class Command(BaseCommand):
    help = 'Charge les comptes démo et les données CSV (cuves, groupes, rapports CarburFlow).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dir',
            type=str,
            default='data',
            help='Répertoire contenant les fichiers CSV (défaut : data)',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprimer les données métier existantes avant import',
        )
        parser.add_argument(
            '--skip-accounts',
            action='store_true',
            help='Ne pas recréer les comptes démo',
        )
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='Ne pas demander de confirmation si --reset',
        )

    def handle(self, *args, **options):
        data_dir = Path(options['dir'])
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir

        if options['reset']:
            if not options['noinput']:
                confirm = input(
                    f'Supprimer toutes les données métier et recharger depuis {data_dir} ? [y/N] '
                )
                if confirm.strip().lower() not in {'y', 'yes', 'o', 'oui'}:
                    self.stdout.write(self.style.WARNING('Opération annulée.'))
                    return

            self.stdout.write(self.style.WARNING('Suppression des données existantes…'))
            LigneRapport.objects.all().delete()
            Rapport.objects.all().delete()
            CuveJournaliere.objects.all().delete()
            GroupeElectrogene.objects.all().delete()
            CuvePrincipale.objects.all().delete()
            reset_sqlite_sequences('dashboard')
            self.stdout.write(self.style.SUCCESS('Données métier supprimées'))

        if not options['skip_accounts']:
            self.stdout.write(self.style.NOTICE('Comptes démo…'))
            call_command('seed_accounts', stdout=self.stdout, stderr=self.stderr)

        self.stdout.write(self.style.NOTICE(f'Import CSV depuis {data_dir}…'))
        call_command(
            'import_csv',
            dir=str(data_dir),
            user='admin',
            stdout=self.stdout,
            stderr=self.stderr,
        )
        self.stdout.write(self.style.SUCCESS('Seed terminé.'))
