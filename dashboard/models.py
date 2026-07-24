from django.db import models


class CuvePrincipale(models.Model):
    identifiant = models.CharField(max_length=100, unique=True)
    capacite = models.FloatField()

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
        return f"CuveJournaliere liée à {self.groupe_electrogene.identifiant}"


class Rapport(models.Model):
    date_debut = models.DateField()
    date_fin = models.DateField()

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
        return f"LigneRapport {self.id} du rapport {self.rapport.id}"
