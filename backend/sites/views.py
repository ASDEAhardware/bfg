from rest_framework import viewsets, permissions, status #type: ignore
from rest_framework.decorators import action #type: ignore
from rest_framework.response import Response #type: ignore
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import Site, UserSiteAccess
from .serializers import (
    SiteSerializer,
    SiteListSerializer,
    UserSiteAccessSerializer
)


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated]

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

    @action(detail=False, methods=['get'])
    def user_sites(self, request):
        """Get sites accessible by the current user for dropdown"""
        sites = self.get_queryset()
        serializer = SiteListSerializer(sites, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def grant_access(self, request, pk=None):
        """Grant user access to a site"""
        if not request.user.is_superuser:
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
            User = get_user_model()
            user = User.objects.get(id=user_id)

            access, created = UserSiteAccess.objects.get_or_create(
                user=user,
                site=site,
                defaults={'granted_by': request.user}
            )

            if created:
                return Response({'message': 'Access granted successfully'})
            else:
                return Response({'message': 'User already has access to this site'})

        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['delete'])
    def revoke_access(self, request, pk=None):
        """Revoke user access to a site"""
        if not request.user.is_superuser:
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

