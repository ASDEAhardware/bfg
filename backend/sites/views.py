from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Site, UserSiteAccess, Datalogger, Sensor
from .serializers import (
    SiteSerializer,
    SiteListSerializer,
    UserSiteAccessSerializer,
    DataloggerListSerializer,
    DataloggerDetailSerializer,
    SensorSerializer
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
            from django.contrib.auth import get_user_model
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


class DataloggerViewSet(viewsets.ModelViewSet):
    queryset = Datalogger.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return DataloggerListSerializer
        return DataloggerDetailSerializer

    def get_queryset(self):
        """Filter dataloggers based on user site access"""
        user = self.request.user
        site_id = self.request.query_params.get('site_id')

        if user.is_superuser:
            queryset = Datalogger.objects.select_related('site').prefetch_related('sensors')
        else:
            # Return only dataloggers from sites the user has access to
            queryset = Datalogger.objects.filter(
                site__user_accesses__user=user,
                site__is_active=True
            ).select_related('site').prefetch_related('sensors').distinct()

        # Filter by site_id if provided
        if site_id:
            queryset = queryset.filter(site_id=site_id)

        return queryset

    @action(detail=False, methods=['get'], url_path='by-site/(?P<site_id>[^/.]+)')
    def by_site(self, request, site_id=None):
        """Get all dataloggers for a specific site"""
        try:
            # Check if user has access to this site
            site = Site.objects.get(id=site_id)
            if not request.user.is_superuser:
                # Verify user has access to this site
                if not UserSiteAccess.objects.filter(user=request.user, site=site).exists():
                    return Response(
                        {'error': 'You do not have access to this site'},
                        status=status.HTTP_403_FORBIDDEN
                    )

            dataloggers = Datalogger.objects.filter(
                site_id=site_id,
                is_active=True
            ).select_related('site').prefetch_related('sensors')

            serializer = DataloggerListSerializer(dataloggers, many=True)
            return Response(serializer.data)

        except Site.DoesNotExist:
            return Response(
                {'error': 'Site not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update datalogger status (for MQTT integration)"""
        datalogger = self.get_object()
        new_status = request.data.get('status')
        last_communication = request.data.get('last_communication')

        if new_status and new_status in ['active', 'inactive', 'maintenance', 'error']:
            datalogger.status = new_status

        if last_communication:
            from django.utils.dateparse import parse_datetime
            datalogger.last_communication = parse_datetime(last_communication)

        datalogger.save()
        serializer = self.get_serializer(datalogger)
        return Response(serializer.data)


class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter sensors based on user site access"""
        user = self.request.user
        if user.is_superuser:
            return Sensor.objects.select_related('datalogger__site')

        # Return only sensors from dataloggers of sites the user has access to
        return Sensor.objects.filter(
            datalogger__site__user_accesses__user=user,
            datalogger__site__is_active=True
        ).select_related('datalogger__site').distinct()

    @action(detail=False, methods=['get'], url_path='by-datalogger/(?P<datalogger_id>[^/.]+)')
    def by_datalogger(self, request, datalogger_id=None):
        """Get all sensors for a specific datalogger"""
        try:
            # Check if user has access to this datalogger's site
            datalogger = Datalogger.objects.select_related('site').get(id=datalogger_id)
            if not request.user.is_superuser:
                if not UserSiteAccess.objects.filter(user=request.user, site=datalogger.site).exists():
                    return Response(
                        {'error': 'You do not have access to this datalogger'},
                        status=status.HTTP_403_FORBIDDEN
                    )

            sensors = Sensor.objects.filter(
                datalogger_id=datalogger_id,
                is_active=True
            ).select_related('datalogger__site')

            serializer = self.get_serializer(sensors, many=True)
            return Response(serializer.data)

        except Datalogger.DoesNotExist:
            return Response(
                {'error': 'Datalogger not found'},
                status=status.HTTP_404_NOT_FOUND
            )