
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser
from .models import UserPreferences

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('username', 'email', 'is_staff', 'profile_image')
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("profile_image",)}),
    )

@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    model = UserPreferences
    list_display = ('user', 'theme', 'show_resize_handle', 'accelerometer_unit', 'inclinometer_unit', 'language')
