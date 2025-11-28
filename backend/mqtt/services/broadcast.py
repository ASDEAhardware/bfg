from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# Nome del gruppo definito nel consumer
GROUP_NAME = "mqtt_status_updates"

def broadcast_status_update(site_id: int, status: str, is_active: bool):
    """
    Invia un messaggio di aggiornamento di stato al gruppo WebSocket.
    """
    channel_layer = get_channel_layer()
    
    # Prepara il messaggio da inviare
    message = {
        'type': 'status.update',  # Corrisponde al metodo `status_update` nel consumer
        'message': {
            'site_id': site_id,
            'status': status,
            'is_active': is_active
        }
    }

    # Invia il messaggio al gruppo
    # async_to_sync è necessario perché stiamo chiamando codice asincrono (channels)
    # da un contesto sincrono (un segnale di Django).
    async_to_sync(channel_layer.group_send)(GROUP_NAME, message)
