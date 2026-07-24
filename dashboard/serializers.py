from rest_framework import serializers
from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
    RapportSoumission,
)


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ['id', 'nom_site', 'localisation']


class CuvePrincipaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuvePrincipale
        fields = ['id', 'identifiant', 'capacite']


class CuveJournaliereSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuveJournaliere
        fields = ['id', 'cuve_principale', 'capacite', 'groupe_electrogene']


class GroupeElectrogeneSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupeElectrogene
        fields = [
            'id',
            'identifiant',
            'compteur_horaire',
            'marque',
            'puissance',
        ]


class RapportSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()

    class Meta:
        model = Rapport
        fields = ['id', 'date_debut', 'date_fin', 'created_by', 'created_by_username', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by_id else None


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


class RapportSoumissionSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    rapport_label = serializers.SerializerMethodField()

    class Meta:
        model = RapportSoumission
        fields = [
            'id',
            'filename',
            'format',
            'status',
            'rows_imported',
            'message',
            'rapport',
            'rapport_label',
            'username',
            'created_at',
        ]

    def get_username(self, obj):
        return obj.user.username if obj.user_id else None

    def get_rapport_label(self, obj):
        if not obj.rapport_id:
            return None
        r = obj.rapport
        return f'#{r.id} ({r.date_debut} → {r.date_fin})'
