from pathlib import Path

from django.db import migrations, models


def backfill_cj_identifiant(apps, schema_editor):
    """Remplit identifiant depuis data/cuve_journaliere.csv (ordre d’import historique)."""
    CuveJournaliere = apps.get_model('dashboard', 'CuveJournaliere')
    root = Path(__file__).resolve().parents[2]
    csv_path = root / 'data' / 'cuve_journaliere.csv'
    if not csv_path.exists():
        return

    import csv
    import io

    raw = csv_path.read_bytes().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(raw))
    for idx, row in enumerate(reader, start=1):
        name = (row.get('id_cuve_journaliere') or '').strip()
        if not name:
            continue
        # L’import seed crée les CJ avec id = rang dans le CSV (1..n)
        CuveJournaliere.objects.filter(pk=idx, identifiant__isnull=True).update(identifiant=name)
        # Si l’id a divergé, tenter via la cuve principale + absence d’identifiant
        if not CuveJournaliere.objects.filter(identifiant=name).exists():
            cp_name = (row.get('id_cuve_principale') or '').strip()
            qs = CuveJournaliere.objects.filter(
                identifiant__isnull=True,
                cuve_principale__identifiant=cp_name,
            )
            obj = qs.first()
            if obj:
                # éviter collision unique
                if not CuveJournaliere.objects.filter(identifiant=name).exists():
                    obj.identifiant = name
                    obj.save(update_fields=['identifiant'])


def noop_reverse(apps, schema_editor):
    pass


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
        migrations.RunPython(backfill_cj_identifiant, noop_reverse),
    ]
