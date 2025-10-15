from django.urls import path
from . import views

app_name = 'mqtt'

urlpatterns = [
    # Control API (legacy)
    path('connection/<int:site_id>/control/', views.MqttConnectionControlView.as_view(), name='connection_control'),

    # Real-time API
    path('api/status/', views.MqttApiStatusView.as_view(), name='api_status'),
    path('api/sensors/<int:site_id>/', views.MqttApiSensorDataView.as_view(), name='api_sensors'),

    # Service control API
    path('service/status/', views.MqttServiceStatusView.as_view(), name='service_status'),
    path('service/control/', views.MqttServiceControlView.as_view(), name='service_control'),
]