from rest_framework.permissions import BasePermission, SAFE_METHODS


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser or user.is_staff:
        return 'admin'
    profile = getattr(user, 'profile', None)
    if profile:
        return profile.role
    return 'user'


def user_is_admin(user):
    return get_user_role(user) == 'admin'


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and user_is_admin(request.user))


class IsAdminOrReadOnlyAuthenticated(BasePermission):
    """Admins : tout. Opérateurs : lecture seule (sauf vues qui override)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_is_admin(request.user):
            return True
        return request.method in SAFE_METHODS
