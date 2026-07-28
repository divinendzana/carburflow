from django.apps import apps
from django.db import connection


def reset_sqlite_sequences(app_label: str) -> None:
    """Remet à zéro les séquences AUTOINCREMENT SQLite après un vidage de tables."""
    if connection.vendor != 'sqlite':
        return

    app_config = apps.get_app_config(app_label)
    with connection.cursor() as cursor:
        for model in app_config.get_models():
            table = model._meta.db_table
            cursor.execute('DELETE FROM sqlite_sequence WHERE name = %s', [table])
