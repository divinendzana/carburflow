from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from dashboard.models import (
    UserProfile,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)


# ─── User ────────────────────────────────────────────────────────────────────

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
    list_display = ('user', 'role', 'created_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email')


# ─── Cuves ───────────────────────────────────────────────────────────────────

@admin.register(CuvePrincipale)
class CuvePrincipaleAdmin(admin.ModelAdmin):
    list_display = ('identifiant', 'capacite')
    search_fields = ('identifiant',)
    ordering = ('identifiant',)


@admin.register(GroupeElectrogene)
class GroupeElectrogeneAdmin(admin.ModelAdmin):
    list_display = ('identifiant', 'marque', 'puissance')
    search_fields = ('identifiant', 'marque', 'puissance')
    ordering = ('identifiant',)


@admin.register(CuveJournaliere)
class CuveJournaliereAdmin(admin.ModelAdmin):
    list_display = ('id', 'identifiant', 'capacite', 'cuve_principale', 'groupe_electrogene')
    list_filter = ('cuve_principale',)
    search_fields = ('identifiant', 'groupe_electrogene__identifiant', 'cuve_principale__identifiant')


# ─── Rapports ────────────────────────────────────────────────────────────────

class LigneRapportInline(admin.TabularInline):
    model = LigneRapport
    extra = 0


@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ('id', 'date_debut', 'date_fin')
    date_hierarchy = 'date_debut'
    ordering = ('-date_debut',)
    inlines = [LigneRapportInline]


@admin.register(LigneRapport)
class LigneRapportAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'rapport',
        'cuve_principale',
        'cuve_journaliere',
        'groupe_electrogene',
        'quantite_gasoil_cuve_principale',
        'quantite_gasoil_cuve_journaliere',
        'compteur_horaire',
        'depotage',
        'etat_fonctionnement',
    )
    list_filter = ('etat_fonctionnement', 'rapport')
    search_fields = ('observations',)
