from rest_framework import serializers
from dashboard.models import (
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)


class CuvePrincipaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuvePrincipale
        fields = ['id', 'identifiant', 'capacite']


class CuveJournaliereSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuveJournaliere
        fields = ['id', 'identifiant', 'cuve_principale', 'capacite', 'groupe_electrogene']


class GroupeElectrogeneSerializer(serializers.ModelSerializer):
    compteur_horaire = serializers.SerializerMethodField()

    class Meta:
        model = GroupeElectrogene
        fields = [
            'id',
            'identifiant',
            'compteur_horaire',
            'marque',
            'puissance',
        ]

    def get_compteur_horaire(self, obj):
        from dashboard.models import LigneRapport
        last = (
            LigneRapport.objects.filter(groupe_electrogene=obj, compteur_horaire__isnull=False)
            .order_by('-rapport__date_fin', '-id')
            .first()
        )
        return last.compteur_horaire if last and last.compteur_horaire is not None else 0.0


class RapportSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()
    lignes_count = serializers.SerializerMethodField()

    class Meta:
        model = Rapport
        fields = [
            'id',
            'date_debut',
            'date_fin',
            'created_by',
            'created_by_username',
            'lignes_count',
        ]

    def get_created_by_username(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        full = f'{user.first_name} {user.last_name}'.strip()
        return full or user.username

    def get_lignes_count(self, obj):
        # Utilise le prefetch si présent
        if hasattr(obj, '_prefetched_objects_cache') and 'lignes' in obj._prefetched_objects_cache:
            return len(obj.lignes.all())
        return obj.lignes.count()


class LigneRapportSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneRapport
        fields = [
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
            'observations',
        ]
