from django.db import models

class Site(models.Model):
    nom_site = models.CharField(max_length=100, verbose_name="Nom du site")
    localisation = models.CharField(max_length=200, blank=True, verbose_name="Localisation")

    class Meta:
        verbose_name = "Site"
        verbose_name_plural = "Sites"

    def __str__(self):
        return f"{self.nom_site} ({self.localisation})" if self.localisation else self.nom_site


class CuvePrincipale(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="cuves_principales", verbose_name="Site")
    capacite = models.FloatField(verbose_name="Capacité (Litres)")

    class Meta:
        verbose_name = "Cuve Principale"
        verbose_name_plural = "Cuves Principales"

    def __str__(self):
        return f"Cuve Principale #{self.id} - Site: {self.site.nom_site} ({self.capacite}L)"


class CuveJournaliere(models.Model):
    cuve_principale = models.ForeignKey(CuvePrincipale, on_delete=models.CASCADE, related_name="cuves_journalieres", verbose_name="Cuve Principale")
    capacite = models.FloatField(verbose_name="Capacité (Litres)")

    class Meta:
        verbose_name = "Cuve Journalière"
        verbose_name_plural = "Cuves Journalières"

    def __str__(self):
        return f"Cuve Journalière #{self.id} (Principale #{self.cuve_principale_id}) - {self.capacite}L"


class GroupeElectrogene(models.Model):
    compteur_horaire = models.FloatField(default=0.0, verbose_name="Compteur horaire (heures)")
    consommation_horaire = models.FloatField(default=0.0, verbose_name="Consommation horaire (L/h)")
    marque = models.CharField(max_length=100, blank=True, verbose_name="Marque")
    puissance = models.CharField(max_length=50, blank=True, verbose_name="Puissance (ex: 250kVA)")
    cuves_journalieres = models.ManyToManyField(
        CuveJournaliere,
        related_name="groupes_electrogenes",
        blank=True,
        verbose_name="Cuves journalières associées"
    )

    class Meta:
        verbose_name = "Groupe Électrogène"
        verbose_name_plural = "Groupes Électrogènes"

    def __str__(self):
        label = f"Groupe #{self.id}"
        if self.marque:
            label += f" ({self.marque} - {self.puissance})"
        return label


class Rapport(models.Model):
    date_debut = models.DateField(verbose_name="Date de début")
    date_fin = models.DateField(verbose_name="Date de fin")

    class Meta:
        verbose_name = "Rapport"
        verbose_name_plural = "Rapports"

    def __str__(self):
        return f"Rapport #{self.id} ({self.date_debut} au {self.date_fin})"


class LigneRapport(models.Model):
    rapport = models.ForeignKey(Rapport, on_delete=models.CASCADE, related_name="lignes", verbose_name="Rapport")
    cuve_principale = models.ForeignKey(CuvePrincipale, on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_rapport")
    cuve_journaliere = models.ForeignKey(CuveJournaliere, on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_rapport")
    groupe = models.ForeignKey(GroupeElectrogene, on_delete=models.SET_NULL, null=True, blank=True, related_name="lignes_rapport")
    quantite_gasoil_cuve_principale = models.FloatField(default=0.0, verbose_name="Qté Gasoil Cuve Principale (L)")
    quantite_gasoil_cuve_journaliere = models.FloatField(default=0.0, verbose_name="Qté Gasoil Cuve Journalière (L)")
    compteur_horaire = models.FloatField(default=0.0, verbose_name="Compteur horaire (h)")
    depotage = models.FloatField(default=0.0, verbose_name="Dépotage (L)")
    etat_fonctionnement = models.CharField(max_length=50, default="F", verbose_name="État de fonctionnement")
    observations = models.TextField(blank=True, default="", verbose_name="Observations")

    class Meta:
        verbose_name = "Ligne de Rapport"
        verbose_name_plural = "Lignes de Rapport"

    def __str__(self):
        return f"Ligne #{self.id} du Rapport #{self.rapport_id}"
