import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from .models import Site, UserSiteAccess
from .serializers import (
    SiteSerializer,
    SiteListSerializer,
    UserSiteAccessSerializer
)

logger = logging.getLogger('django.security')

# Custom throttling classes per operazioni sensibili
class SensitiveOperationThrottle(UserRateThrottle):
    scope = 'sensitive'

class AdminOperationThrottle(UserRateThrottle):
    scope = 'sensitive'

    def allow_request(self, request, view):
        if not request.user.is_superuser:
            return super().allow_request(request, view)
        # Admin users have higher limits
        return True


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get_queryset(self):
        """Filter sites based on user permissions"""
        user = self.request.user
        if user.is_superuser:
            return Site.objects.all()

        # Return only sites the user has access to
        return Site.objects.filter(
            user_accesses__user=user,
            is_active=True
        ).distinct()

    @method_decorator(cache_page(60 * 5))  # Cache per 5 minuti
    @action(detail=False, methods=['get'])
    def user_sites(self, request):
        """Get sites accessible by the current user for dropdown"""
        sites = self.get_queryset()
        serializer = SiteListSerializer(sites, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], throttle_classes=[AdminOperationThrottle])
    def grant_access(self, request, pk=None):
        """Grant user access to a site"""
        if not request.user.is_superuser:
            logger.warning(f"Non-admin user {request.user.username} attempted to grant site access")
            return Response(
                {'error': 'Only administrators can grant site access'},
                status=status.HTTP_403_FORBIDDEN
            )

        site = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(id=user_id)

            access, created = UserSiteAccess.objects.get_or_create(
                user=user,
                site=site,
                defaults={'granted_by': request.user}
            )

            if created:
                logger.info(f"Admin {request.user.username} granted site access to user {user.username} for site {site.name}")
                return Response({'message': 'Access granted successfully'})
            else:
                return Response({'message': 'User already has access to this site'})

        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['delete'], throttle_classes=[AdminOperationThrottle])
    def revoke_access(self, request, pk=None):
        """Revoke user access to a site"""
        if not request.user.is_superuser:
            logger.warning(f"Non-admin user {request.user.username} attempted to revoke site access")
            return Response(
                {'error': 'Only administrators can revoke site access'},
                status=status.HTTP_403_FORBIDDEN
            )

        site = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            access = UserSiteAccess.objects.get(
                user_id=user_id,
                site=site
            )
            access.delete()
            logger.info(f"Admin {request.user.username} revoked site access from user {access.user.username} for site {site.name}")
            return Response({'message': 'Access revoked successfully'})

        except UserSiteAccess.DoesNotExist:
            return Response(
                {'error': 'User does not have access to this site'},
                status=status.HTTP_404_NOT_FOUND
            )


class UserSiteAccessViewSet(viewsets.ModelViewSet):
    queryset = UserSiteAccess.objects.all()
    serializer_class = UserSiteAccessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter access records based on user permissions"""
        user = self.request.user
        if user.is_superuser:
            return UserSiteAccess.objects.all()

        # Return only access records for sites the user can see
        return UserSiteAccess.objects.filter(
            site__user_accesses__user=user
        ).distinct()

    def perform_create(self, serializer):
        """Set granted_by when creating new access record"""
        serializer.save(granted_by=self.request.user)