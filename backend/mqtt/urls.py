"""
URL patterns per API MQTT
"""
from django.urls import path
from .api import views
from .api import datalogger_views

app_name = 'mqtt'

urlpatterns = [
    # Controllo connessioni per sito specifico
    path('sites/<int:site_id>/start/', views.start_connection, name='start_connection'),
    path('sites/<int:site_id>/stop/', views.stop_connection, name='stop_connection'),
    path('sites/<int:site_id>/status/', views.connection_status, name='connection_status'),

    # Stato generale manager
    path('manager/status/', views.manager_status, name='manager_status'),
    path('manager/restart/', views.restart_manager, name='restart_manager'),

    # Lista e stato tutte le connessioni
    path('connections/', views.connections_list, name='connections_list'),
    path('connections/status/', views.all_connections_status, name='all_connections_status'),

    # Datalogger endpoints
    path('dataloggers/', datalogger_views.dataloggers_list, name='dataloggers_list'),
    path('dataloggers/<int:datalogger_id>/', datalogger_views.datalogger_detail, name='datalogger_detail'),
    path('dataloggers/<int:datalogger_id>/update_label/', datalogger_views.update_datalogger_label, name='update_datalogger_label'),

    # Sensor endpoints
    path('sensors/by_datalogger/', datalogger_views.sensors_by_datalogger, name='sensors_by_datalogger'),
    path('sensors/<int:sensor_id>/', datalogger_views.sensor_detail, name='sensor_detail'),
    path('sensors/<int:sensor_id>/update_label/', datalogger_views.update_sensor_label, name='update_sensor_label'),
]