from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from dashboard.auth_serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)
from dashboard.models import UserProfile
from dashboard.permissions import get_user_role


def ensure_profile(user):
    if hasattr(user, 'profile'):
        return user.profile
    role = UserProfile.ROLE_ADMIN if (user.is_superuser or user.is_staff) else UserProfile.ROLE_USER
    return UserProfile.objects.create(user=user, role=role)


def build_auth_payload(user):
    ensure_profile(user)
    user.refresh_from_db()
    token, _ = Token.objects.get_or_create(user=user)
    return {
        'token': token.key,
        'user': UserSerializer(user).data,
    }


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RegisterSerializer, tags=['Auth'], summary='Inscription opérateur')
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(build_auth_payload(user), status=status.HTTP_201_CREATED)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=LoginSerializer, tags=['Auth'], summary='Connexion')
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(build_auth_payload(serializer.validated_data['user']))


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Auth'], summary='Déconnexion')
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'detail': 'Déconnecté.'})


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserSerializer}, tags=['Auth'], summary='Profil courant')
    def get(self, request):
        ensure_profile(request.user)
        request.user.refresh_from_db()
        data = UserSerializer(request.user).data
        data['role'] = get_user_role(request.user)
        return Response(data)


class CsrfAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(tags=['Auth'], summary='Jeton CSRF')
    def get(self, request):
        return Response({'csrfToken': get_token(request)})
