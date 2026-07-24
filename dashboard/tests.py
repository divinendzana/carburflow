from django.test import TestCase

from dashboard.models import (
    CuveJournaliere,
    CuvePrincipale,
    GroupeElectrogene,
    LigneRapport,
    Rapport,
    Site,
)
from dashboard.analytics import build_groupe_timeseries
from dashboard.views import get_consommation_context


class ConsumptionAnalyticsTests(TestCase):
    def test_total_consumption_uses_stock_change_and_depotage(self):
        site = Site.objects.create(nom_site="Site test")
        cuve_principale = CuvePrincipale.objects.create(site=site, capacite=5000)
        cuve_journaliere = CuveJournaliere.objects.create(cuve_principale=cuve_principale, capacite=1000)
        groupe = GroupeElectrogene.objects.create(
            consommation_horaire=10.0,
            marque="Test",
            puissance="100kVA",
        )
        groupe.cuves_journalieres.add(cuve_journaliere)

        rapport_1 = Rapport.objects.create(date_debut="2026-01-01", date_fin="2026-01-07")
        rapport_2 = Rapport.objects.create(date_debut="2026-01-08", date_fin="2026-01-14")

        LigneRapport.objects.create(
            rapport=rapport_1,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            quantite_gasoil_cuve_principale=1000.0,
            quantite_gasoil_cuve_journaliere=100.0,
            depotage=0.0,
        )
        LigneRapport.objects.create(
            rapport=rapport_2,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            quantite_gasoil_cuve_principale=800.0,
            quantite_gasoil_cuve_journaliere=50.0,
            depotage=300.0,
        )

        context = get_consommation_context()

        self.assertEqual(context['consommation_global_json'], '[0.0, 550.0]')

    def test_group_consumption_uses_stock_change_and_depotage(self):
        site = Site.objects.create(nom_site="Site groupes")
        cuve_principale = CuvePrincipale.objects.create(site=site, capacite=5000)
        cuve_journaliere = CuveJournaliere.objects.create(cuve_principale=cuve_principale, capacite=1000)
        groupe = GroupeElectrogene.objects.create(
            consommation_horaire=10.0,
            marque="Test",
            puissance="100kVA",
        )
        groupe.cuves_journalieres.add(cuve_journaliere)

        rapport_1 = Rapport.objects.create(date_debut="2026-01-01", date_fin="2026-01-07")
        rapport_2 = Rapport.objects.create(date_debut="2026-01-08", date_fin="2026-01-14")

        LigneRapport.objects.create(
            rapport=rapport_1,
            groupe=groupe,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            quantite_gasoil_cuve_principale=1000.0,
            quantite_gasoil_cuve_journaliere=100.0,
            depotage=0.0,
        )
        LigneRapport.objects.create(
            rapport=rapport_2,
            groupe=groupe,
            cuve_principale=cuve_principale,
            cuve_journaliere=cuve_journaliere,
            quantite_gasoil_cuve_principale=800.0,
            quantite_gasoil_cuve_journaliere=50.0,
            depotage=300.0,
        )

        timeseries = build_groupe_timeseries()

        self.assertEqual(timeseries['consumption_by_groupe'][groupe.id][1], 550.0)
