# mqtt/urls.py

from django.urls import path
from .views import send_mqtt_command, get_datalogger_status, get_discovered_devices, start_subscriber, stop_subscriber, get_subscriber_status

app_name = 'mqtt'

urlpatterns = [
    # Datalogger operations
    path('datalogger/control/', send_mqtt_command, name='datalogger-control'),
    path('datalogger/status/', get_datalogger_status, name='datalogger-status'),
    path('datalogger/devices/', get_discovered_devices, name='datalogger-devices'),

    # Subscriber management
    path('subscriber/start/', start_subscriber, name='subscriber-start'),
    path('subscriber/stop/', stop_subscriber, name='subscriber-stop'),
    path('subscriber/status/', get_subscriber_status, name='subscriber-status'),
]
