"""
Étape 3 — Insertion des lignes de rapport (après analyse / création des entités).

Usage :
  python manage.py import_rapport_lignes chemin/vers/rapport.xlsx
  python manage.py import_rapport_lignes rapport.csv --create-missing
  python manage.py import_rapport_lignes rapport.csv --user admin
"""

from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from dashboard.norme import ImportValidationError
from dashboard.rapport_pipeline import import_rapport_file


class Command(BaseCommand):
    help = (
        'Importe un fichier rapport : crée le Rapport et insère les LigneRapport. '
        'Par défaut, refuse les IDs inconnus (passez par create_rapport_entities, '
        'ou utilisez --create-missing).'
    )

    def add_arguments(self, parser):
        parser.add_argument('fichier', type=str, help='Chemin du fichier .xlsx ou .csv')
        parser.add_argument(
            '--create-missing',
            action='store_true',
            help='Crée automatiquement les sites/groupes manquants avant l’insertion',
        )
        parser.add_argument(
            '--allow-unknown',
            action='store_true',
            help='Autorise l’import même si des IDs restent inconnus (FK null) — déconseillé',
        )
        parser.add_argument(
            '--user',
            type=str,
            default='',
            help='Username à associer comme importateur (created_by)',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Sortie JSON',
        )

    def handle(self, *args, **options):
        path = options['fichier']
        user = None
        username = (options.get('user') or '').strip()
        if username:
            User = get_user_model()
            user = User.objects.filter(username=username).first()
            if not user:
                raise CommandError(f'Utilisateur introuvable : {username}')

        try:
            result = import_rapport_file(
                path,
                user=user,
                create_missing=options['create_missing'],
                require_entities=not options['allow_unknown'],
            )
        except ImportValidationError as exc:
            if options['json']:
                self.stdout.write(json.dumps(exc.as_dict(), ensure_ascii=False, indent=2))
            else:
                self.stderr.write(self.style.ERROR(exc.message))
                for err in exc.errors[:20]:
                    self.stderr.write(
                        f"  L{err.get('row')} | {err.get('column')}: {err.get('message')}"
                    )
            raise SystemExit(1) from exc

        if options['json']:
            self.stdout.write(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
            return

        self.stdout.write(self.style.SUCCESS('Import terminé.'))
        self.stdout.write(f'  Rapport n°{result.rapport_id}')
        self.stdout.write(f'  Période : {result.date_debut} → {result.date_fin}')
        self.stdout.write(f'  Lignes insérées : {result.imported_lines}')
        if result.created_entities:
            c = result.created_entities
            self.stdout.write(
                self.style.WARNING(
                    '  Entités créées à la volée : '
                    f'CP={c.created_cuves_principales} '
                    f'CJ={c.created_cuves_journalieres} '
                    f'G={c.created_groupes}'
                )
            )
