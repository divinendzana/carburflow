"""
Étape 2 — Création des sites / cuves / groupes détectés par l'analyse.

Usage :
  python manage.py create_rapport_entities chemin/vers/rapport.xlsx
  python manage.py create_rapport_entities rapport.csv --dry-run
"""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from dashboard.norme import ImportValidationError
from dashboard.rapport_pipeline import (
    analyze_rapport_file,
    create_entities_from_analysis,
)


class Command(BaseCommand):
    help = (
        'Crée en base les sites (cuves principales), cuves journalières et groupes '
        'identifiés comme nouveaux par l’analyse du fichier rapport.'
    )

    def add_arguments(self, parser):
        parser.add_argument('fichier', type=str, help='Chemin du fichier .xlsx ou .csv')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche ce qui serait créé, sans écrire en base',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Sortie JSON',
        )
        parser.add_argument(
            '--capacite-cp',
            type=float,
            default=10000.0,
            help='Capacité par défaut des cuves principales créées (L)',
        )
        parser.add_argument(
            '--capacite-cj',
            type=float,
            default=1000.0,
            help='Capacité par défaut des cuves journalières créées (L)',
        )

    def handle(self, *args, **options):
        path = options['fichier']
        try:
            analysis = analyze_rapport_file(path)
        except ImportValidationError as exc:
            raise CommandError(exc.message) from exc

        if not analysis.ok:
            raise CommandError(
                'Le fichier contient des erreurs de cohérence. '
                'Lancez d’abord : python manage.py analyze_rapport ' + path
            )

        pending = (
            len(analysis.new_cuves_principales)
            + len(analysis.new_cuves_journalieres)
            + len(analysis.new_groupes)
        )
        if pending == 0:
            msg = 'Rien à créer : toutes les entités du fichier existent déjà.'
            if options['json']:
                self.stdout.write(json.dumps({'created': False, 'detail': msg}, ensure_ascii=False))
            else:
                self.stdout.write(self.style.SUCCESS(msg))
            return

        if options['dry_run']:
            payload = {
                'dry_run': True,
                'would_create_cuves_principales': [r.key for r in analysis.new_cuves_principales],
                'would_create_cuves_journalieres': [r.key for r in analysis.new_cuves_journalieres],
                'would_create_groupes': [r.key for r in analysis.new_groupes],
            }
            if options['json']:
                self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
            else:
                self.stdout.write(self.style.WARNING('Mode dry-run — aucune écriture.'))
                self.stdout.write(f"  Cuves principales : {payload['would_create_cuves_principales']}")
                self.stdout.write(f"  Cuves journalières : {payload['would_create_cuves_journalieres']}")
                self.stdout.write(f"  Groupes : {payload['would_create_groupes']}")
            return

        try:
            with transaction.atomic():
                created = create_entities_from_analysis(
                    analysis,
                    default_cp_capacity=options['capacite_cp'],
                    default_cj_capacity=options['capacite_cj'],
                )
        except ImportValidationError as exc:
            raise CommandError(exc.message) from exc

        if options['json']:
            self.stdout.write(json.dumps(created.to_dict(), ensure_ascii=False, indent=2))
            return

        self.stdout.write(self.style.SUCCESS('Entités créées :'))
        self.stdout.write(f'  Cuves principales : {created.created_cuves_principales or "—"}')
        self.stdout.write(f'  Cuves journalières : {created.created_cuves_journalieres or "—"}')
        self.stdout.write(f'  Groupes : {created.created_groupes or "—"}')
        if created.skipped_existing:
            self.stdout.write(self.style.WARNING(f'  Ignorés (déjà présents) : {created.skipped_existing}'))
        self.stdout.write('')
        self.stdout.write(
            self.style.NOTICE(
                'Étape suivante : python manage.py import_rapport_lignes ' + path
            )
        )
