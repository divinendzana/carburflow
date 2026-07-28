from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_USER = 'user'
    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Administrateur'),
        (ROLE_USER, 'Opérateur'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='Utilisateur',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_USER,
        verbose_name='Rôle',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Profil utilisateur'
        verbose_name_plural = 'Profils utilisateurs'

    def __str__(self):
        return f'{self.user.username} ({self.get_role_display()})'

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN or self.user.is_superuser or self.user.is_staff


# Alias de compatibilité
ProfilUtilisateur = UserProfile


class CuvePrincipale(models.Model):
    identifiant = models.CharField(max_length=100, unique=True)
    capacite = models.FloatField()

    def __str__(self):
        return f'CuvePrincipale {self.identifiant}'


class GroupeElectrogene(models.Model):
    identifiant = models.CharField(max_length=100, unique=True)
    marque = models.CharField(max_length=100)
    puissance = models.CharField(max_length=100)

    def __str__(self):
        return f'Groupe {self.identifiant}'


class CuveJournaliere(models.Model):
    # Nom terrain (fiche de suivi), ex. "BEPANDA NATIONAL 1"
    identifiant = models.CharField(max_length=100, unique=True)
    capacite = models.FloatField()
    cuve_principale = models.ForeignKey(
        CuvePrincipale,
        on_delete=models.CASCADE,
        related_name='cuves_journaliere',
    )
    groupe_electrogene = models.OneToOneField(
        GroupeElectrogene,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cuve_journaliere',
    )

    def __str__(self):
        if self.identifiant:
            return f'CuveJournaliere {self.identifiant}'
        if self.groupe_electrogene:
            return f'CuveJournaliere liée à {self.groupe_electrogene.identifiant}'
        return f'CuveJournaliere {self.id}'


class Rapport(models.Model):
    date_debut = models.DateField(verbose_name='Date de début')
    date_fin = models.DateField(verbose_name='Date de fin')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Créé par',
    )

    class Meta:
        verbose_name = 'Rapport'
        verbose_name_plural = 'Rapports'
        ordering = ['date_debut', 'date_fin', 'id']

    def __str__(self):
        return f'Rapport du {self.date_debut} au {self.date_fin}'


class LigneRapport(models.Model):
    rapport = models.ForeignKey(
        Rapport,
        on_delete=models.CASCADE,
        related_name='lignes',
    )
    cuve_principale = models.ForeignKey(
        CuvePrincipale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lignes_rapport',
    )
    cuve_journaliere = models.ForeignKey(
        CuveJournaliere,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lignes_rapport',
    )
    groupe_electrogene = models.ForeignKey(
        GroupeElectrogene,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lignes_rapport',
    )

    quantite_gasoil_cuve_principale = models.FloatField(null=True, blank=True)
    quantite_gasoil_cuve_journaliere = models.FloatField(null=True, blank=True)
    compteur_horaire = models.FloatField(null=True, blank=True)
    depotage = models.FloatField(null=True, blank=True)
    etat_fonctionnement = models.CharField(max_length=100, null=True, blank=True)
    observations = models.TextField(null=True, blank=True)

    def __str__(self):
        return f'Ligne #{self.id} du Rapport #{self.rapport_id}'
