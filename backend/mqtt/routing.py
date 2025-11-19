from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # URL per le notifiche di stato delle connessioni MQTT
    path('ws/status/', consumers.MqttStatusConsumer.as_asgi()),
]
