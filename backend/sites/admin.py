from django.contrib import admin
from .models import Site, UserSiteAccess


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'site_type', 'customer_name', 'latitude', 'longitude', 'is_active', 'created_at')
    list_filter = ('site_type', 'is_active', 'customer_name', 'created_at')
    search_fields = ('name', 'code', 'customer_name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'code', 'site_type', 'customer_name', 'description', 'is_active')
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