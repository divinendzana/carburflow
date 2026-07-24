from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from dashboard.views import (
    EtatCuvesAPIView,
    CuvesDashboardAPIView,
    EvolutionVolumesAPIView,
    HorairesGroupesAPIView,
    ConsommationAPIView,
    GroupesDashboardAPIView,
    SiteViewSet,
    CuvePrincipaleViewSet,
    CuveJournaliereViewSet,
    GroupeElectrogeneViewSet,
    RapportViewSet,
    LigneRapportViewSet,
)

router = DefaultRouter(trailing_slash=False)
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'cuves_principales', CuvePrincipaleViewSet, basename='cuveprincipale')
router.register(r'cuves_journaliere', CuveJournaliereViewSet, basename='cuvejournaliere')
router.register(r'groupes', GroupeElectrogeneViewSet, basename='groupe-electrogene')
router.register(r'rapports', RapportViewSet, basename='rapport')
router.register(r'lignes_rapport', LigneRapportViewSet, basename='lignerapport')

urlpatterns = [
    # Analytics Dashboard API Endpoints
    path('dashboard/etat_cuves', EtatCuvesAPIView.as_view(), name='api-dashboard-etat-cuves'),
    path('dashboard/evolution_volumes', EvolutionVolumesAPIView.as_view(), name='api-dashboard-evolution-volumes'),
    path('dashboard/horaires_groupes', HorairesGroupesAPIView.as_view(), name='api-dashboard-horaires-groupes'),
    path('dashboard/consommation', ConsommationAPIView.as_view(), name='api-dashboard-consommation'),
    path('dashboard/groupes', GroupesDashboardAPIView.as_view(), name='api-dashboard-groupes'),
    path('dashboard/cuves', CuvesDashboardAPIView.as_view(), name='api-dashboard-cuves'),

    # Documentations Swagger UI & Schema OpenAPI
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Endpoints API v1 REST
    path('', include(router.urls)),
]
