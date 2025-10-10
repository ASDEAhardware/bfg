from django.apps import AppConfig


class SitesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sites'
    label= 'custom_sites'
    verbose_name = 'Site Management'