from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from dashboard.views import (
    CuvePrincipaleViewSet,
    CuveJournaliereViewSet,
    GroupeElectrogeneViewSet,
    RapportViewSet,
    LigneRapportViewSet,
    SitesVolumeAPIView,
    SitesDureeAPIView,
    SitesConsommationAPIView,
    DashboardOverviewAPIView,
    GroupesAPIView,
)

router = DefaultRouter(trailing_slash=False)
router.register(r'cuves_principales', CuvePrincipaleViewSet, basename='cuveprincipale')
router.register(r'cuves_journaliere', CuveJournaliereViewSet, basename='cuvejournaliere')
router.register(r'groupes', GroupeElectrogeneViewSet, basename='groupe-electrogene')
router.register(r'rapports', RapportViewSet, basename='rapport')
router.register(r'lignes_rapport', LigneRapportViewSet, basename='lignerapport')

urlpatterns = [
    # Documentations Swagger UI & Schema OpenAPI
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Endpoints API v1 REST
    path('', include(router.urls)),
    path('dashboard/volume_sites', SitesVolumeAPIView.as_view(), name='dashboard-volume-sites'),
    path('dashboard/duree_sites', SitesDureeAPIView.as_view(), name='dashboard-duree-sites'),
    path('dashboard/consommation_sites', SitesConsommationAPIView.as_view(), name='dashboard-consommation-sites'),
    path('dashboard/overview', DashboardOverviewAPIView.as_view(), name='dashboard-overview'),
    path('dashboard/groupes', GroupesAPIView.as_view(), name='dashboard-groupes'),
]
