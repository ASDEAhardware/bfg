import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import mqtt.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Importa l'applicazione Django HTTP dopo aver impostato DJANGO_SETTINGS_MODULE
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    # Gestore per le richieste HTTP e HTTPS
    "http": django_asgi_app,

    # Gestore per le richieste WebSocket
    "websocket": AuthMiddlewareStack(
        URLRouter(
            mqtt.routing.websocket_urlpatterns
        )
    ),
})