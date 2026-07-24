from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from dashboard.models import Site, UserProfile
from dashboard.permissions import get_user_role


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    site_id = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'is_staff',
            'site_id',
            'site_name',
        ]

    def get_role(self, obj):
        return get_user_role(obj) or UserProfile.ROLE_USER

    def get_full_name(self, obj):
        name = obj.get_full_name().strip()
        return name or obj.username

    def get_site_id(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.site_id if profile else None

    def get_site_name(self, obj):
        profile = getattr(obj, 'profile', None)
        if profile and profile.site_id:
            return profile.site.nom_site
        return None


class PublicSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ['id', 'nom_site', 'localisation']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    site_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_username(self, value):
        username = value.strip()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError('Ce nom d’utilisateur est déjà pris.')
        return username

    def validate_site_id(self, value):
        if value is None:
            return value
        if not Site.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Site introuvable.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Les mots de passe ne correspondent pas.'})
        try:
            validate_password(attrs['password'])
        except Exception:
            # Accepte des mots de passe courts en démo (ex. user123) si la longueur min est OK
            if len(attrs['password']) < 6:
                raise serializers.ValidationError({'password': 'Mot de passe trop court (min. 6).'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        site_id = validated_data.pop('site_id', None)
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        user.set_password(password)
        user.save()
        site = Site.objects.filter(pk=site_id).first() if site_id else None
        UserProfile.objects.create(user=user, role=UserProfile.ROLE_USER, site=site)
        Token.objects.get_or_create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs['username'].strip(),
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError('Identifiants incorrects.')
        if not user.is_active:
            raise serializers.ValidationError('Ce compte est désactivé.')
        attrs['user'] = user
        return attrs
