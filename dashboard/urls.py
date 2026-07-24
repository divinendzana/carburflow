from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from dashboard.views import (
    dashboard_index_view,
    etat_cuves_component_view,
    evolution_volumes_component_view,
    horaires_groupes_component_view,
    consommation_component_view,
    groupes_dashboard_view,
    EtatCuvesAPIView,
    CuvesDashboardAPIView,
    EvolutionVolumesAPIView,
    HorairesGroupesAPIView,
    ConsommationAPIView,
    AlertesAPIView,
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
    # Vue Dashboard HTML Principale & composants
    path('', dashboard_index_view, name='dashboard-index'),
    path('groupes/', groupes_dashboard_view, name='groupes-dashboard'),
    path('component/etat-cuves/', etat_cuves_component_view, name='component-etat-cuves'),
    path('component/evolution-volumes/', evolution_volumes_component_view, name='component-evolution-volumes'),
    path('component/horaires-groupes/', horaires_groupes_component_view, name='component-horaires-groupes'),
    path('component/consommation/', consommation_component_view, name='component-consommation'),

    # Analytics Dashboard API Endpoints
    path('dashboard/etat_cuves', EtatCuvesAPIView.as_view(), name='api-dashboard-etat-cuves'),
    path('dashboard/evolution_volumes', EvolutionVolumesAPIView.as_view(), name='api-dashboard-evolution-volumes'),
    path('dashboard/horaires_groupes', HorairesGroupesAPIView.as_view(), name='api-dashboard-horaires-groupes'),
    path('dashboard/consommation', ConsommationAPIView.as_view(), name='api-dashboard-consommation'),
    path('dashboard/alertes', AlertesAPIView.as_view(), name='api-dashboard-alertes'),
    path('dashboard/groupes', GroupesDashboardAPIView.as_view(), name='api-dashboard-groupes'),
    path('dashboard/cuves', CuvesDashboardAPIView.as_view(), name='api-dashboard-cuves'),

    # Documentations Swagger UI & Schema OpenAPI
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Endpoints API v1 REST
    path('', include(router.urls)),
]
