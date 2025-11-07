from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import MqttConnection
from .services.broadcast import broadcast_status_update

@receiver(post_save, sender=MqttConnection)
def mqtt_connection_post_save(sender, instance, created, **kwargs):
    """
    In ascolto del segnale post_save per il modello MqttConnection.
    Invia un aggiornamento via WebSocket ogni volta che lo stato di una connessione cambia.
    """
    # Invia sempre l'aggiornamento. Il frontend gestirà la logica di visualizzazione.
    broadcast_status_update(
        site_id=instance.site.id,
        status=instance.status,
        is_enabled=instance.is_enabled
    )
