# mqtt/admin.py

from django.contrib import admin
from .models import Device, DataloggerStatus, SubscriberStatus

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('serial_number', 'ip_address', 'software_version', 'last_seen')
    search_fields = ('serial_number', 'ip_address')
    list_filter = ('software_version',)

@admin.register(DataloggerStatus)
class DataloggerStatusAdmin(admin.ModelAdmin):
    list_display = ('status', 'details', 'timestamp')
    list_filter = ('status',)

    def has_add_permission(self, request):
        # Disallow adding new statuses through the admin panel, as they are created automatically
        return False

    def has_delete_permission(self, request, obj=None):
        # Disallow deletion
        return False


@admin.register(SubscriberStatus)
class SubscriberStatusAdmin(admin.ModelAdmin):
    list_display = ('status', 'last_heartbeat', 'process_id', 'error_message')
    list_filter = ('status',)
    readonly_fields = ('last_heartbeat',)

    def has_add_permission(self, request):
        # Disallow adding new subscriber statuses through admin
        return False

    def has_delete_permission(self, request, obj=None):
        # Disallow deletion
        return False
