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

    # Control API (legacy)
    path('connection/<int:site_id>/control/', views.MqttConnectionControlView.as_view(), name='connection_control'),

    # Real-time API
    path('api/status/', views.MqttApiStatusView.as_view(), name='api_status'),
    path('api/sensors/<int:site_id>/', views.MqttApiSensorDataView.as_view(), name='api_sensors'),
    path('api/system-info/<int:site_id>/', views.MqttApiSystemInfoView.as_view(), name='api_system_info'),

    # Service control API
    path('service/status/', views.MqttServiceStatusView.as_view(), name='service_status'),
    path('service/control/', views.MqttServiceControlView.as_view(), name='service_control'),
]