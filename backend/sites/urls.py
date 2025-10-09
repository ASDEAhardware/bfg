from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, UserSiteAccessViewSet

router = DefaultRouter()
router.register('sites', SiteViewSet)
router.register('access', UserSiteAccessViewSet)

urlpatterns = [
    path('', include(router.urls)),
]