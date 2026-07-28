from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0004_cuvejournaliere_code_identifiant'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='groupeelectrogene',
            name='compteur_horaire',
        ),
    ]
