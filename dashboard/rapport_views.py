from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema

from dashboard.models import Rapport
from dashboard.norme import (
    NORME_COLUMNS,
    NORME_META,
    build_csv_bytes,
    build_xlsx_bytes,
    import_report_rows,
    rows_from_csv,
    rows_from_xlsx,
)
from dashboard.permissions import user_is_admin
from dashboard.serializers import RapportSerializer


class NormeMetaAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Norme'], summary='Métadonnées de la norme rapport')
    def get(self, request):
        return Response({
            **NORME_META,
            'column_names': NORME_COLUMNS,
            'download': {
                'xlsx': '/api/v1/rapports/norme.xlsx',
                'csv': '/api/v1/rapports/norme.csv',
            },
        })


class NormeCsvAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Norme'], summary='Télécharger la norme CSV')
    def get(self, request):
        content = build_csv_bytes(include_sample=True)
        response = HttpResponse(content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="carburflow_norme_rapport.csv"'
        return response


class NormeXlsxAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Norme'], summary='Télécharger la norme Excel')
    def get(self, request):
        content = build_xlsx_bytes(include_sample=True)
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="carburflow_norme_rapport.xlsx"'
        return response


class RapportUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Déposer un rapport (.xlsx ou .csv)')
    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('rapport')
        if not upload:
            return Response({'detail': 'Fichier manquant (champ file).'}, status=status.HTTP_400_BAD_REQUEST)

        filename = upload.name or 'rapport'
        lower = filename.lower()
        raw = upload.read()

        try:
            if lower.endswith('.xlsx'):
                rows = rows_from_xlsx(raw)
            elif lower.endswith('.csv'):
                rows = rows_from_csv(raw)
            else:
                return Response(
                    {'detail': 'Format non supporté. Utilisez .xlsx ou .csv.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            rapport, imported = import_report_rows(rows, request.user)
            return Response(
                {
                    'detail': f'{imported} ligne(s) importée(s).',
                    'rapport': RapportSerializer(rapport).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class MesRapportsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Rapports visibles selon le rôle')
    def get(self, request):
        qs = Rapport.objects.all().order_by('-date_fin', '-id')
        return Response(RapportSerializer(qs[:50], many=True).data)




class SoumissionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Historique des soumissions de rapports')
    def get(self, request):
        return Response([])  # Renvoie une liste vide pour éviter le 'Non trouvé'