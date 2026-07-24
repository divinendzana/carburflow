from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
    UserProfile,
    RapportSoumission,
)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    fk_name = 'user'


class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_role', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'profile__role')

    @admin.display(description='Rôle')
    def get_role(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else '—'


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'site', 'created_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email')
    autocomplete_fields = ('site',)


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
    list_display = ('id', 'date_debut', 'date_fin', 'created_by', 'created_at')
    list_filter = ('date_debut',)


@admin.register(LigneRapport)
class LigneRapportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'rapport', 'cuve_principale', 'cuve_journaliere', 'groupe',
        'depotage', 'etat_fonctionnement',
    )
    list_filter = ('rapport', 'etat_fonctionnement')


@admin.register(RapportSoumission)
class RapportSoumissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'filename', 'user', 'status', 'rows_imported', 'created_at')
    list_filter = ('status', 'format')
