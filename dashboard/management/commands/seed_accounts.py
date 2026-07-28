from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token

from dashboard.models import UserProfile


class Command(BaseCommand):
    help = 'Crée les comptes démo admin/admin (superuser) et user/user123.'

    def handle(self, *args, **options):
        accounts = [
            {
                'username': 'admin',
                'email': 'admin@carburflow.local',
                'password': 'admin',
                'first_name': 'Admin',
                'last_name': 'CarburFlow',
                'role': UserProfile.ROLE_ADMIN,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'username': 'user',
                'email': 'user@carburflow.local',
                'password': 'user123',
                'first_name': 'Agent',
                'last_name': 'Terrain',
                'role': UserProfile.ROLE_USER,
                'is_staff': False,
                'is_superuser': False,
            },
        ]

        for account in accounts:
            role = account.pop('role')
            password = account.pop('password')
            username = account['username']
            user, created = User.objects.update_or_create(
                username=username,
                defaults=account,
            )
            user.set_password(password)
            user.save()
            profile, _ = UserProfile.objects.update_or_create(
                user=user,
                defaults={'role': role},
            )
            Token.objects.get_or_create(user=user)
            action = 'créé' if created else 'mis à jour'
            self.stdout.write(
                self.style.SUCCESS(f'Compte {action}: {username} / {password} (rôle={profile.role})')
            )
