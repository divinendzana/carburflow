from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema

from django.shortcuts import get_object_or_404

from dashboard.models import Rapport
from dashboard.norme import (
    NORME_COLUMNS,
    NORME_META,
    ImportValidationError,
    build_csv_bytes,
    build_rapport_csv_bytes,
    build_rapport_xlsx_bytes,
    build_xlsx_bytes,
    import_report_rows,
    rows_from_csv,
    rows_from_xlsx,
)
from dashboard.permissions import user_is_admin
from dashboard.serializers import RapportSerializer


def _user_can_access_rapport(user, rapport: Rapport) -> bool:
    if user_is_admin(user):
        return True
    return rapport.created_by_id == getattr(user, 'id', None)


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


class GenererRapportHebdoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Norme'], summary='Générer la fiche de relevé hebdomadaire pré-remplie Excel')
    def get(self, request):
        from dashboard.rapport_pipeline import generate_rapport_template_xlsx
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        content = generate_rapport_template_xlsx(date_debut, date_fin)
        filename = 'carburflow_fiche_hebdo.xlsx'
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
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
                    {
                        'detail': 'Ce type de fichier n’est pas accepté.',
                        'errors': [
                            {
                                'row': None,
                                'column': None,
                                'column_label': None,
                                'message': f'Le fichier « {filename} » n’est pas un Excel ou un CSV.',
                                'how_to_fix': 'Choisissez un fichier se terminant par .xlsx ou .csv (modèle de l’étape 1).',
                            }
                        ],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Admin : peut créer à la volée les sites/groupes inconnus détectés.
            # Opérateur : doit utiliser des IDs déjà connus (ou passer par les scripts CLI).
            create_missing = user_is_admin(request.user)
            rapport, imported = import_report_rows(
                rows,
                request.user,
                create_missing=create_missing,
            )
            return Response(
                {
                    'detail': (
                        f'C’est bon : {imported} ligne(s) ont été enregistrée(s). '
                        'Vous pouvez les retrouver plus bas dans la liste.'
                    ),
                    'rapport': RapportSerializer(rapport).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ImportValidationError as exc:
            return Response(exc.as_dict(), status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {
                    'detail': 'Le fichier n’a pas pu être importé.',
                    'errors': [
                        {
                            'row': None,
                            'column': None,
                            'column_label': None,
                            'message': str(exc),
                            'how_to_fix': (
                                'Vérifiez que vous utilisez le modèle téléchargé, '
                                'puis recommencez. Si le problème continue, contactez un responsable.'
                            ),
                        }
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class MesRapportsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Rapports visibles selon le rôle')
    def get(self, request):
        qs = (
            Rapport.objects.all()
            .select_related('created_by')
            .prefetch_related('lignes')
            .order_by('-date_fin', '-id')
        )
        if not user_is_admin(request.user):
            qs = qs.filter(created_by=request.user)
        return Response(RapportSerializer(qs[:100], many=True).data)


class SoumissionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Historique des soumissions de rapports')
    def get(self, request):
        qs = (
            Rapport.objects.all()
            .select_related('created_by')
            .prefetch_related('lignes')
            .order_by('-id')
        )
        if not user_is_admin(request.user):
            qs = qs.filter(created_by=request.user)

        items = []
        for rapport in qs[:100]:
            user = rapport.created_by
            username = None
            if user:
                full = f'{user.first_name} {user.last_name}'.strip()
                username = full or user.username
            rows = rapport.lignes.count()
            items.append({
                'id': rapport.id,
                'created_at': f'{rapport.date_fin}T12:00:00',
                'date_debut': rapport.date_debut,
                'date_fin': rapport.date_fin,
                'filename': f'Rapport #{rapport.id}',
                'status': 'success',
                'rows_imported': rows,
                'username': username,
                'message': f'{rows} ligne(s) importée(s).',
            })
        return Response(items)


class RapportDeleteAPIView(APIView):
    """Suppression d'un rapport — réservée aux responsables.

    Respecte le modèle Grinnel : LigneRapport.rapport est en CASCADE,
    donc les lignes liées sont retirées avec le rapport (pas de migration).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Supprimer un rapport (admin)')
    def delete(self, request, rapport_id):
        if not user_is_admin(request.user):
            return Response(
                {'detail': 'Seul un responsable peut supprimer un rapport.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        rapport = get_object_or_404(Rapport, pk=rapport_id)
        from dashboard.rapport_pipeline import delete_rapport_and_orphans

        deleted = delete_rapport_and_orphans(rapport)
        parts = [f'{deleted["lignes"]} ligne(s)']
        if deleted['cuves_principales']:
            parts.append(f'{len(deleted["cuves_principales"])} site(s)')
        if deleted['cuves_journalieres']:
            parts.append(f'{len(deleted["cuves_journalieres"])} cuve(s) journalière(s)')
        if deleted['groupes']:
            parts.append(f'{len(deleted["groupes"])} groupe(s)')
        return Response(
            {
                'detail': (
                    f'Le rapport n°{deleted["rapport_id"]} a été supprimé '
                    f'({", ".join(parts)} retiré(s)).'
                ),
                'id': deleted['rapport_id'],
                'orphans_removed': {
                    'cuves_principales': deleted['cuves_principales'],
                    'cuves_journalieres': deleted['cuves_journalieres'],
                    'groupes': deleted['groupes'],
                },
            },
            status=status.HTTP_200_OK,
        )


class RapportExportAPIView(APIView):
    """Téléchargement d'un rapport importé (admin: tous ; opérateur: les siens)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Rapports'], summary='Exporter un rapport importé (xlsx ou csv)')
    def get(self, request, rapport_id, export_format):
        rapport = get_object_or_404(
            Rapport.objects.select_related('created_by').prefetch_related('lignes'),
            pk=rapport_id,
        )
        if not _user_can_access_rapport(request.user, rapport):
            return Response({'detail': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        fmt = (export_format or '').lower()
        if fmt == 'xlsx':
            content = build_rapport_xlsx_bytes(rapport)
            content_type = (
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        elif fmt == 'csv':
            content = build_rapport_csv_bytes(rapport)
            content_type = 'text/csv; charset=utf-8'
        else:
            return Response(
                {'detail': 'Format non supporté. Utilisez xlsx ou csv.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filename = f'carburflow_rapport_{rapport.id}.{fmt}'
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response