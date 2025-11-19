from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import MqttConnection
from .services.broadcast import broadcast_status_update

@receiver(post_save, sender=MqttConnection)
def mqtt_connection_post_save(sender, instance, created, update_fields, **kwargs):
    """
    In ascolto del segnale post_save per il modello MqttConnection.
    Invia un aggiornamento via WebSocket solo quando il campo 'status' cambia,
    per evitare di sovrascrivere l'aggiornamento ottimistico del frontend.
    """
    should_broadcast = False
    
    # Vogliamo notificare il frontend solo quando lo stato effettivo della connessione
    # (connecting, connected, error, etc.) viene modificato dal servizio MQTT,
    # non quando la vista API imposta semplicemente `is_enabled`.
    if update_fields and 'status' in update_fields:
        should_broadcast = True

    if should_broadcast:
        broadcast_status_update(
            site_id=instance.site.id,
            status=instance.status,
            is_enabled=instance.is_enabled
        )
