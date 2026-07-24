from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from dashboard.auth_views import (
    CsrfAPIView,
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    PublicSitesAPIView,
    RegisterAPIView,
)
from dashboard.rapport_views import (
    MesRapportsAPIView,
    NormeCsvAPIView,
    NormeMetaAPIView,
    NormeXlsxAPIView,
    RapportSoumissionListAPIView,
    RapportUploadAPIView,
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
from dashboard.permissions import IsAdminRole
from rest_framework.permissions import AllowAny

router = DefaultRouter(trailing_slash=False)
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'cuves_principales', CuvePrincipaleViewSet, basename='cuveprincipale')
router.register(r'cuves_journaliere', CuveJournaliereViewSet, basename='cuvejournaliere')
router.register(r'groupes', GroupeElectrogeneViewSet, basename='groupe-electrogene')
router.register(r'rapports', RapportViewSet, basename='rapport')
router.register(r'lignes_rapport', LigneRapportViewSet, basename='lignerapport')

# Docs publiques
SpectacularAPIView.permission_classes = [AllowAny]
SpectacularSwaggerView.permission_classes = [AllowAny]
SpectacularRedocView.permission_classes = [AllowAny]

# Analytics réservées aux admins
for _view in (
    EtatCuvesAPIView,
    CuvesDashboardAPIView,
    EvolutionVolumesAPIView,
    HorairesGroupesAPIView,
    ConsommationAPIView,
    GroupesDashboardAPIView,
):
    _view.permission_classes = [IsAdminRole]

urlpatterns = [
    # Auth
    path('auth/register', RegisterAPIView.as_view(), name='api-auth-register'),
    path('auth/login', LoginAPIView.as_view(), name='api-auth-login'),
    path('auth/logout', LogoutAPIView.as_view(), name='api-auth-logout'),
    path('auth/me', MeAPIView.as_view(), name='api-auth-me'),
    path('auth/csrf', CsrfAPIView.as_view(), name='api-auth-csrf'),
    path('auth/sites', PublicSitesAPIView.as_view(), name='api-auth-sites'),

    # Norme & dépôt rapports
    path('rapports/norme', NormeMetaAPIView.as_view(), name='api-norme-meta'),
    path('rapports/norme.csv', NormeCsvAPIView.as_view(), name='api-norme-csv'),
    path('rapports/norme.xlsx', NormeXlsxAPIView.as_view(), name='api-norme-xlsx'),
    path('rapports/upload', RapportUploadAPIView.as_view(), name='api-rapport-upload'),
    path('rapports/soumissions', RapportSoumissionListAPIView.as_view(), name='api-rapport-soumissions'),
    path('rapports/mes', MesRapportsAPIView.as_view(), name='api-rapports-mes'),

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
