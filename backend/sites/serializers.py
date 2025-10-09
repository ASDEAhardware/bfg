from rest_framework import serializers
from .models import Site, UserSiteAccess


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = [
            'id',
            'name',
            'site_type',
            'latitude',
            'longitude',
            'customer_name',
            'description',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


class SiteListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdown lists"""
    class Meta:
        model = Site
        fields = ['id', 'name', 'customer_name', 'site_type']


class UserSiteAccessSerializer(serializers.ModelSerializer):
    site = SiteListSerializer(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    granted_by_username = serializers.CharField(source='granted_by.username', read_only=True)

    class Meta:
        model = UserSiteAccess
        fields = [
            'id',
            'user',
            'user_username',
            'site',
            'granted_at',
            'granted_by',
            'granted_by_username'
        ]
        read_only_fields = ('id', 'granted_at')