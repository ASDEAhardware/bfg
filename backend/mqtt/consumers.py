import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer

# Nome del gruppo a cui tutti i client si uniranno per ricevere broadcast
GROUP_NAME = "mqtt_status_updates"

class MqttStatusConsumer(AsyncWebsocketConsumer):
    """
    Questo consumer gestisce le connessioni WebSocket per gli aggiornamenti
    in tempo reale dello stato delle connessioni MQTT.
    """

    async def connect(self):
        """
        Chiamato quando un client tenta di connettersi via WebSocket.
        """
        import logging
        logger = logging.getLogger('mqtt.websocket')

        try:
            logger.info(f"WebSocket connection attempt from {self.scope['client']}")

            # Aggiunge il client al gruppo di broadcast
            await self.channel_layer.group_add(
                GROUP_NAME,
                self.channel_name
            )
            logger.info(f"Added client to group {GROUP_NAME}")

            # Accetta la connessione WebSocket
            await self.accept()
            logger.info("WebSocket connection accepted")

            # Invia un messaggio di conferma connessione
            await self.send(text_data=json.dumps({
                "type": "connection_established",
                "message": "WebSocket connected successfully"
            }))
            logger.info("Confirmation message sent to client")

        except Exception as e:
            logger.error(f"Error in WebSocket connect: {e}", exc_info=True)
            raise

    async def disconnect(self, close_code):
        """
        Chiamato alla chiusura della connessione WebSocket.
        """
        import logging
        logger = logging.getLogger('mqtt.websocket')

        logger.info(f"WebSocket disconnecting with code {close_code}")

        # Rimuove il client dal gruppo di broadcast
        await self.channel_layer.group_discard(
            GROUP_NAME,
            self.channel_name
        )
        logger.info(f"Removed client from group {GROUP_NAME}")

    async def status_update(self, event):
        """
        Questo metodo è l'handler per i messaggi inviati al nostro gruppo.
        Quando il backend invia un messaggio al gruppo 'mqtt_status_updates' con 
        `type: 'status.update'`, questo metodo viene invocato.
        
        L'evento contiene il messaggio che dobbiamo inoltrare al client.
        """
        message = event["message"]

        # Invia il messaggio al client attraverso la connessione WebSocket
        await self.send(text_data=json.dumps(message))