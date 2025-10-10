from django.contrib import admin
from .models import Site, UserSiteAccess, Datalogger, Sensor


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'site_type', 'customer_name', 'latitude', 'longitude', 'is_active', 'created_at')
    list_filter = ('site_type', 'is_active', 'customer_name', 'created_at')
    search_fields = ('name', 'customer_name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'site_type', 'customer_name', 'description', 'is_active')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(UserSiteAccess)
class UserSiteAccessAdmin(admin.ModelAdmin):
    list_display = ('user', 'site', 'granted_at', 'granted_by')
    list_filter = ('site', 'granted_at')
    search_fields = ('user__username', 'site__name', 'site__customer_name')
    readonly_fields = ('granted_at',)
    autocomplete_fields = ('user', 'site', 'granted_by')


@admin.register(Datalogger)
class DataloggerAdmin(admin.ModelAdmin):
    list_display = ('name', 'site', 'serial_number', 'model', 'status', 'ip_address', 'is_active', 'last_communication')
    list_filter = ('site', 'status', 'model', 'is_active', 'created_at')
    search_fields = ('name', 'serial_number', 'model', 'site__name', 'site__customer_name')
    readonly_fields = ('installed_at', 'created_at', 'updated_at')
    autocomplete_fields = ('site',)
    fieldsets = (
        ('Basic Information', {
            'fields': ('site', 'name', 'serial_number', 'model', 'firmware_version')
        }),
        ('Network Configuration', {
            'fields': ('ip_address',)
        }),
        ('Status & Monitoring', {
            'fields': ('status', 'is_active', 'last_communication', 'description')
        }),
        ('Timestamps', {
            'fields': ('installed_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ('name', 'datalogger', 'sensor_type', 'channel', 'unit_of_measure', 'status', 'is_active', 'last_reading')
    list_filter = ('datalogger__site', 'datalogger', 'sensor_type', 'status', 'is_active', 'created_at')
    search_fields = ('name', 'datalogger__name', 'datalogger__site__name', 'unit_of_measure')
    readonly_fields = ('installed_at', 'created_at', 'updated_at')
    autocomplete_fields = ('datalogger',)
    fieldsets = (
        ('Basic Information', {
            'fields': ('datalogger', 'name', 'sensor_type', 'channel', 'unit_of_measure')
        }),
        ('Value Range', {
            'fields': ('min_value', 'max_value')
        }),
        ('Calibration', {
            'fields': ('calibration_factor', 'calibration_offset')
        }),
        ('Status & Monitoring', {
            'fields': ('status', 'is_active', 'last_reading', 'description')
        }),
        ('Timestamps', {
            'fields': ('installed_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )