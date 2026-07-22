from rest_framework import serializers
from dashboard.models import (
    Site,
    CuvePrincipale,
    CuveJournaliere,
    GroupeElectrogene,
    Rapport,
    LigneRapport,
)


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ['id', 'nom_site', 'localisation']


class CuvePrincipaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuvePrincipale
        fields = ['id', 'site', 'capacite']


class CuveJournaliereSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuveJournaliere
        fields = ['id', 'cuve_principale', 'capacite']


class GroupeElectrogeneSerializer(serializers.ModelSerializer):
    cuves_journalieres = serializers.PrimaryKeyRelatedField(
        queryset=CuveJournaliere.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = GroupeElectrogene
        fields = [
            'id',
            'compteur_horaire',
            'consommation_horaire',
            'marque',
            'puissance',
            'cuves_journalieres',
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
            'groupe',
            'quantite_gasoil_cuve_principale',
            'quantite_gasoil_cuve_journaliere',
            'compteur_horaire',
            'depotage',
            'etat_fonctionnement',
            'observations',
        ]
