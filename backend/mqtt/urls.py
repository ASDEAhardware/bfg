from django.urls import path
from . import views

app_name = 'mqtt'

urlpatterns = [
    # Dashboard views
    path('dashboard/', views.MqttDashboardView.as_view(), name='dashboard'),
    path('site/<int:site_id>/', views.MqttSiteDetailView.as_view(), name='site_detail'),

    # Control API
    path('connection/<int:site_id>/control/', views.MqttConnectionControlView.as_view(), name='connection_control'),

    # Real-time API
    path('api/status/', views.MqttApiStatusView.as_view(), name='api_status'),
    path('api/sensors/<int:site_id>/', views.MqttApiSensorDataView.as_view(), name='api_sensors'),

    # Service control API
    path('service/status/', views.MqttServiceStatusView.as_view(), name='service_status'),
    path('service/logs/', views.MqttServiceLogsView.as_view(), name='service_logs'),
    path('service/control/', views.MqttServiceControlView.as_view(), name='service_control'),
]