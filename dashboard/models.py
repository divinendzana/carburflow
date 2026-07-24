from django.conf import settings
from django.db import models


class Site(models.Model):
    nom_site = models.CharField(max_length=100, verbose_name="Nom du site")
    localisation = models.CharField(max_length=200, blank=True, verbose_name="Localisation")

    class Meta:
        verbose_name = "Site"
        verbose_name_plural = "Sites"

    def __str__(self):
        return f"{self.nom_site} ({self.localisation})" if self.localisation else self.nom_site


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
    site = models.ForeignKey(
        'Site',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operateurs',
        verbose_name='Site rattaché',
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


ProfilUtilisateur = UserProfile


class CuvePrincipale(models.Model):
    identifiant = models.CharField(max_length=100, unique=True)
    capacite = models.FloatField()
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name='cuves_principales',
        null=True,
        blank=True,
        verbose_name='Site',
    )

    def __str__(self):
        return f"CuvePrincipale {self.identifiant}"


class GroupeElectrogene(models.Model):
    identifiant = models.CharField(max_length=100, unique=True)
    compteur_horaire = models.FloatField()
    marque = models.CharField(max_length=100)
    puissance = models.CharField(max_length=100)

    def __str__(self):
        return f"Groupe {self.identifiant}"


class CuveJournaliere(models.Model):
    capacite = models.FloatField()
    cuve_principale = models.ForeignKey(
        CuvePrincipale,
        on_delete=models.CASCADE,
        related_name="cuves_journaliere"
    )
    groupe_electrogene = models.OneToOneField(
        GroupeElectrogene,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cuve_journaliere"
    )

    def __str__(self):
        return f"CuveJournaliere liée à {self.groupe_electrogene.identifiant}" if self.groupe_electrogene else f"CuveJournaliere {self.id}"


class Rapport(models.Model):
    date_debut = models.DateField(verbose_name="Date de début")
    date_fin = models.DateField(verbose_name="Date de fin")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rapports_crees',
        verbose_name='Créé par',
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        verbose_name = "Rapport"
        verbose_name_plural = "Rapports"

    def __str__(self):
        return f"Rapport du {self.date_debut} au {self.date_fin}"


class LigneRapport(models.Model):
    rapport = models.ForeignKey(
        Rapport,
        on_delete=models.CASCADE,
        related_name="lignes"
    )
    cuve_principale = models.ForeignKey(
        CuvePrincipale,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_rapport"
    )
    cuve_journaliere = models.ForeignKey(
        CuveJournaliere,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_rapport"
    )
    groupe_electrogene = models.ForeignKey(
        GroupeElectrogene,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lignes_rapport"
    )

    quantite_gasoil_cuve_principale = models.FloatField(null=True, blank=True)
    quantite_gasoil_cuve_journaliere = models.FloatField(null=True, blank=True)
    compteur_horaire = models.FloatField(null=True, blank=True)
    depotage = models.FloatField(null=True, blank=True)
    etat_fonctionnement = models.CharField(max_length=100, null=True, blank=True)
    observations = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Ligne #{self.id} du Rapport #{self.rapport_id}"


class RapportSoumission(models.Model):
    STATUS_SUCCESS = 'success'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_SUCCESS, 'Succès'),
        (STATUS_ERROR, 'Erreur'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='soumissions_rapport',
        verbose_name='Utilisateur',
    )
    filename = models.CharField(max_length=255)
    format = models.CharField(max_length=10, default='csv')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUCCESS)
    rows_imported = models.PositiveIntegerField(default=0)
    message = models.TextField(blank=True, default='')
    rapport = models.ForeignKey(
        Rapport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='soumissions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Soumission de rapport'
        verbose_name_plural = 'Soumissions de rapports'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.filename} ({self.status}) — {self.user.username}'
