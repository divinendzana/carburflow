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
    class Meta:
        model = Rapport
        fields = ['id', 'date_debut', 'date_fin']


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
