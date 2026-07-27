"""
Étape 1 — Analyse d'un fichier rapport (cohérence + nouveaux sites/groupes).

Usage :
  python manage.py analyze_rapport chemin/vers/rapport.xlsx
  python manage.py analyze_rapport rapport.csv --json
"""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from dashboard.norme import ImportValidationError
from dashboard.rapport_pipeline import analyze_rapport_file


class Command(BaseCommand):
    help = (
        'Analyse un fichier rapport (.xlsx/.csv) : vérifie la cohérence '
        'et liste les sites / cuves / groupes nouveaux ou déjà connus.'
    )

    def add_arguments(self, parser):
        parser.add_argument('fichier', type=str, help='Chemin du fichier .xlsx ou .csv')
        parser.add_argument(
            '--json',
            action='store_true',
            help='Affiche le résultat au format JSON',
        )

    def handle(self, *args, **options):
        path = options['fichier']
        try:
            analysis = analyze_rapport_file(path)
        except ImportValidationError as exc:
            raise CommandError(exc.message) from exc

        if options['json']:
            self.stdout.write(json.dumps(analysis.to_dict(), ensure_ascii=False, indent=2))
            if not analysis.ok:
                raise SystemExit(1)
            return

        self.stdout.write(self.style.NOTICE(f'Fichier : {path}'))
        self.stdout.write(f'Lignes : {analysis.row_count}')
        self.stdout.write(f'Période : {analysis.date_debut or "—"} → {analysis.date_fin or "—"}')
        self.stdout.write('')

        def _print_refs(title, refs, style):
            self.stdout.write(style(title))
            if not refs:
                self.stdout.write('  (aucun)')
                return
            for ref in refs:
                rows = ','.join(str(r) for r in ref.sample_rows) or '—'
                self.stdout.write(f'  • {ref.key}  ({ref.label})  lignes≈{rows}')

        _print_refs(
            f'Sites / cuves principales connus ({len(analysis.known_cuves_principales)})',
            analysis.known_cuves_principales,
            self.style.SUCCESS,
        )
        _print_refs(
            f'NOUVEAUX sites / cuves principales ({len(analysis.new_cuves_principales)})',
            analysis.new_cuves_principales,
            self.style.WARNING,
        )
        _print_refs(
            f'Cuves journalières connues ({len(analysis.known_cuves_journalieres)})',
            analysis.known_cuves_journalieres,
            self.style.SUCCESS,
        )
        _print_refs(
            f'NOUVELLES cuves journalières ({len(analysis.new_cuves_journalieres)})',
            analysis.new_cuves_journalieres,
            self.style.WARNING,
        )
        _print_refs(
            f'Groupes connus ({len(analysis.known_groupes)})',
            analysis.known_groupes,
            self.style.SUCCESS,
        )
        _print_refs(
            f'NOUVEAUX groupes ({len(analysis.new_groupes)})',
            analysis.new_groupes,
            self.style.WARNING,
        )

        self.stdout.write('')
        errors = analysis.errors
        warnings = analysis.warnings
        self.stdout.write(f'Erreurs : {len(errors)}  |  Avertissements : {len(warnings)}')
        for issue in analysis.issues[:40]:
            prefix = '✗' if issue.level == 'error' else '⚠'
            loc = f'L{issue.row}' if issue.row else '—'
            col = issue.column or '—'
            style = self.style.ERROR if issue.level == 'error' else self.style.WARNING
            self.stdout.write(style(f'  {prefix} [{loc} | {col}] {issue.message}'))

        self.stdout.write('')
        if analysis.ok:
            if analysis.new_cuves_principales or analysis.new_cuves_journalieres or analysis.new_groupes:
                self.stdout.write(
                    self.style.WARNING(
                        'Cohérence OK, mais des entités manquent. '
                        'Étape suivante : python manage.py create_rapport_entities ' + path
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        'Analyse OK — aucune nouvelle entité. '
                        'Étape suivante : python manage.py import_rapport_lignes ' + path
                    )
                )
        else:
            self.stdout.write(self.style.ERROR('Analyse KO — corrigez les erreurs avant de continuer.'))
            raise SystemExit(1)
