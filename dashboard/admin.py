from django.contrib import admin
from .models import CuvePrincipale, CuveJournaliere, GroupeElectrogene, Rapport, LigneRapport


@admin.register(CuvePrincipale)
class CuvePrincipaleAdmin(admin.ModelAdmin):
    list_display = ("identifiant", "capacite")
    search_fields = ("identifiant",)
    ordering = ("identifiant",)


@admin.register(GroupeElectrogene)
class GroupeElectrogeneAdmin(admin.ModelAdmin):
    list_display = ("identifiant", "marque", "puissance", "compteur_horaire")
    search_fields = ("identifiant", "marque", "puissance")
    ordering = ("identifiant",)


@admin.register(CuveJournaliere)
class CuveJournaliereAdmin(admin.ModelAdmin):
    list_display = ("id", "capacite", "cuve_principale", "groupe_electrogene")
    list_filter = ("cuve_principale", "groupe_electrogene")
    search_fields = ("id",)


class LigneRapportInline(admin.TabularInline):
    model = LigneRapport
    extra = 0


@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ("id", "date_debut", "date_fin")
    date_hierarchy = "date_debut"
    inlines = [LigneRapportInline]


@admin.register(LigneRapport)
class LigneRapportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "rapport",
        "cuve_principale",
        "cuve_journaliere",
        "groupe_electrogene",
        "quantite_gasoil_cuve_principale",
        "quantite_gasoil_cuve_journaliere",
        "compteur_horaire",
        "depotage",
        "etat_fonctionnement",
    )
    list_filter = ("etat_fonctionnement", "rapport")
    search_fields = ("observations",)
