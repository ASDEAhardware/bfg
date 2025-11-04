 # Scrivere in questo file solo gli endpoint per gli sviluppatori
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from mqtt.api.views import datalogger_mqtt_callback
urlpatterns = [
    path('developers-admin/', admin.site.urls),
    path('api/v1/', include('api.v1.urls')),
    # Datalogger MQTT callbacks (senza autenticazione per permettere callback MQTT)
    path('api/datalogger-control/<int:datalogger_id>/mqtt-callback/',
         datalogger_mqtt_callback,
         name='datalogger_mqtt_callback'),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
