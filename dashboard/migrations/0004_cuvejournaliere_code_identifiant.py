from pathlib import Path

import csv
import io

from django.db import migrations, models


def backfill_cj_identifiant(apps, schema_editor):
    CuveJournaliere = apps.get_model('dashboard', 'CuveJournaliere')
    root = Path(__file__).resolve().parents[2]
    csv_path = root / 'data' / 'cuve_journaliere.csv'
    if not csv_path.exists():
        return

    raw = csv_path.read_bytes().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(raw))
    for idx, row in enumerate(reader, start=1):
        name = (row.get('id_cuve_journaliere') or '').strip()
        if not name:
            continue
        CuveJournaliere.objects.filter(pk=idx, identifiant__isnull=True).update(identifiant=name)


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0003_rapport_created_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='cuvejournaliere',
            name='identifiant',
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='cuvejournaliere',
            name='code',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.RunPython(backfill_cj_identifiant, migrations.RunPython.noop),
    ]
