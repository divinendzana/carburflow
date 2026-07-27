from django.db import migrations, models


def backfill_identifiant_from_code(apps, schema_editor):
    CuveJournaliere = apps.get_model('dashboard', 'CuveJournaliere')
    for obj in CuveJournaliere.objects.filter(identifiant__isnull=True).order_by('id'):
        code = getattr(obj, 'code', None) or ''
        obj.identifiant = code.strip() or f'CJ-{obj.id:04d}'
        obj.save(update_fields=['identifiant'])


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0005_remove_groupeelectrogene_compteur_horaire'),
    ]

    operations = [
        migrations.RunPython(backfill_identifiant_from_code, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='cuvejournaliere',
            name='code',
        ),
        migrations.AlterField(
            model_name='cuvejournaliere',
            name='identifiant',
            field=models.CharField(max_length=100, unique=True),
        ),
    ]
