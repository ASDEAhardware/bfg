from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router per nuove API ViewSets
router = DefaultRouter()
router.register('gateways', views.GatewayViewSet, basename='gateway')
router.register('dataloggers', views.DataloggerViewSet, basename='datalogger')
router.register('sensors', views.SensorViewSet, basename='sensor')

app_name = 'mqtt'

urlpatterns = [
    # Nuove API auto-discovery (DRF ViewSets)
    path('', include(router.urls)),

    # Manual MQTT Control API (superuser only)
    path('sites/<int:site_id>/connection/', views.MqttConnectionManualControlView.as_view(), name='manual_connection_control'),

    # Real-time API
    path('api/status/', views.MqttApiStatusView.as_view(), name='api_status'),
    path('api/sensors/<int:site_id>/', views.MqttApiSensorDataView.as_view(), name='api_sensors'),
    path('api/system-info/<int:site_id>/', views.MqttApiSystemInfoView.as_view(), name='api_system_info'),

]