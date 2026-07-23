from django.contrib import admin
from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)

@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('id', 'nom_site', 'localisation')
    search_fields = ('nom_site', 'localisation')

@admin.register(CuvePrincipale)
class CuvePrincipaleAdmin(admin.ModelAdmin):
    list_display = ('id', 'site', 'capacite')
    list_filter = ('site',)

@admin.register(CuveJournaliere)
class CuveJournaliereAdmin(admin.ModelAdmin):
    list_display = ('id', 'cuve_principale', 'capacite')
    list_filter = ('cuve_principale__site',)

@admin.register(GroupeElectrogene)
class GroupeElectrogeneAdmin(admin.ModelAdmin):
    list_display = ('id', 'marque', 'puissance', 'compteur_horaire', 'consommation_horaire')
    search_fields = ('marque', 'puissance')

@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ('id', 'date_debut', 'date_fin')

@admin.register(LigneRapport)
class LigneRapportAdmin(admin.ModelAdmin):
    list_display = ('id', 'rapport', 'cuve_principale', 'cuve_journaliere', 'groupe', 'depotage', 'etat_fonctionnement')
    list_filter = ('rapport', 'etat_fonctionnement')
