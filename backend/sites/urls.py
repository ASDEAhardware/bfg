from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, UserSiteAccessViewSet, DataloggerViewSet, SensorViewSet

router = DefaultRouter()
router.register('sites', SiteViewSet)
router.register('access', UserSiteAccessViewSet)
router.register('dataloggers', DataloggerViewSet)
router.register('sensors', SensorViewSet)

urlpatterns = [
    path('', include(router.urls)),
]