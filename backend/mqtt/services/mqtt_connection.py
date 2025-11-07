"""
MQTT Connection Manager - Gestisce una singola connessione MQTT per un sito
"""
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Callable, Optional, Dict, Any

import paho.mqtt.client as mqtt
from django.db import transaction
from django.utils import timezone as django_tz

logger = logging.getLogger(__name__)


class MQTTConnectionManager:
    """Gestisce una singola connessione MQTT per un sito"""

    MAX_RETRIES = 10
    BASE_RETRY_DELAY = 5  # secondi
    MAX_RETRY_DELAY = 300  # 5 minuti

    def __init__(self, mqtt_connection_id: int, on_message_callback: Callable):
        """
        Inizializza il manager per una connessione MQTT.

        Args:
            mqtt_connection_id: ID del record MqttConnection nel database
            on_message_callback: Funzione da chiamare quando arriva un messaggio
                                 firma: callback(site_id, topic, payload)
        """
        self.mqtt_connection_id = mqtt_connection_id
        self.site_id = None  # Verrà popolato al primo connect
        self.client: Optional[mqtt.Client] = None
        self.is_running = False
        self.retry_count = 0
        self.on_message_callback = on_message_callback
        self._lock = threading.Lock()
        self._subscribed_topics = []

        # Track connection lifecycle for duplicate prevention
        self.created_at = datetime.now()  # When manager was created
        self.last_connected_at = None  # When connection was successfully established
        self.reconnect_cooldown_until = None  # Prevent reconnect loops (code 7)

    def _get_retry_delay(self) -> int:
        """Calcola delay esponenziale con cap"""
        delay = min(
            self.BASE_RETRY_DELAY * (2 ** self.retry_count),
            self.MAX_RETRY_DELAY
        )
        return delay

    def _update_connection_status(self, status: str, error_message: str = ''):
        """
        Aggiorna stato della connessione nel database.

        Args:
            status: Stato connessione ('connecting', 'connected', 'disconnected', 'error')
            error_message: Messaggio di errore opzionale
        """
        from mqtt.models import MqttConnection

        try:
            with transaction.atomic():
                mqtt_conn = MqttConnection.objects.select_for_update().get(id=self.mqtt_connection_id)
                mqtt_conn.status = status
                mqtt_conn.mqtt_retry_count = self.retry_count

                if status == 'connected':
                    mqtt_conn.last_connected_at = django_tz.now()
                    mqtt_conn.error_message = ''
                    mqtt_conn.mqtt_next_retry = None
                    mqtt_conn.connection_errors = 0
                    self.retry_count = 0

                elif status == 'error':
                    mqtt_conn.error_message = error_message
                    mqtt_conn.connection_errors += 1

                    if self.retry_count < self.MAX_RETRIES:
                        delay = self._get_retry_delay()
                        mqtt_conn.mqtt_next_retry = django_tz.now() + timedelta(seconds=delay)
                        logger.warning(
                            f"[MQTT Connection {self.mqtt_connection_id}] "
                            f"Retry {self.retry_count}/{self.MAX_RETRIES} scheduled in {delay}s"
                        )
                    else:
                        logger.error(
                            f"[MQTT Connection {self.mqtt_connection_id}] "
                            f"Max retries reached. Giving up."
                        )
                        mqtt_conn.mqtt_next_retry = None

                mqtt_conn.save(update_fields=[
                    'status', 'last_connected_at', 'error_message',
                    'mqtt_retry_count', 'mqtt_next_retry', 'connection_errors'
                ])

                logger.debug(f"[MQTT Connection {self.mqtt_connection_id}] Status updated: {status}")

        except Exception as e:
            logger.error(f"[MQTT Connection {self.mqtt_connection_id}] Error updating status: {e}")

    def _on_connect(self, client, userdata, flags, rc):
        """Callback connessione riuscita"""
        if rc == 0:
            # Mark successful connection timestamp
            self.last_connected_at = datetime.now()
            # Clear cooldown on successful connection
            self.reconnect_cooldown_until = None

            logger.info(f"[MQTT Connection {self.mqtt_connection_id}] Connected successfully")
            self._update_connection_status('connected')

            # Pubblica status "online" (contrario del LWT "offline")
            from .mqtt_service import mqtt_service
            from mqtt.models import MqttConnection
            from django.conf import settings

            try:
                mqtt_conn = MqttConnection.objects.get(id=self.mqtt_connection_id)

                if settings.MQTT_CONFIG.get('LWT_ENABLED', True):
                    lwt_topic = f"{mqtt_conn.client_id_prefix}/backend/status"
                    online_payload = json.dumps({
                        "status": "online",
                        "instance_id": mqtt_service.instance_id,
                        "client_id": client._client_id.decode() if hasattr(client._client_id, 'decode') else str(client._client_id),
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })

                    client.publish(
                        topic=lwt_topic,
                        payload=online_payload,
                        qos=1,
                        retain=True
                    )

                    logger.info(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"Published online status to {lwt_topic}"
                    )
            except Exception as e:
                logger.warning(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Failed to publish online status: {e}"
                )

            # Sottoscrivi ai topic configurati
            self._subscribe_to_topics()

        else:
            error_codes = {
                1: "Incorrect protocol version",
                2: "Invalid client identifier",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized"
            }
            error_msg = error_codes.get(rc, f"Connection failed with code {rc}")
            logger.error(f"[MQTT Connection {self.mqtt_connection_id}] {error_msg}")
            self._update_connection_status('error', error_msg)

    def _on_disconnect(self, client, userdata, rc):
        """Callback disconnessione"""
        if rc != 0:
            # Code 7 = connection lost/closed by broker (often "client already connected")
            if rc == 7:
                logger.warning(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Broker closed connection (code {rc}) - likely duplicate client ID. "
                    f"Setting 30s cooldown to prevent reconnect loop."
                )
                # Set cooldown to prevent immediate reconnect loop
                self.reconnect_cooldown_until = datetime.now() + timedelta(seconds=30)
                # Force disconnect to stop loop_start from reconnecting
                try:
                    self.client.disconnect()
                except Exception:
                    pass
            else:
                logger.warning(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Unexpected disconnect (code {rc})"
                )
            self._update_connection_status('disconnected', f"Unexpected disconnect: {rc}")
        else:
            logger.info(f"[MQTT Connection {self.mqtt_connection_id}] Disconnected cleanly")
            self._update_connection_status('disconnected')

    def _on_message(self, client, userdata, msg):
        """Callback ricezione messaggio"""
        try:
            logger.debug(
                f"[MQTT Connection {self.mqtt_connection_id}] "
                f"Message on {msg.topic} ({len(msg.payload)} bytes)"
            )

            # Aggiorna last_heartbeat_at per indicare attività
            self._update_last_heartbeat()

            # Chiama il callback personalizzato per processare il messaggio
            if self.on_message_callback and self.site_id:
                self.on_message_callback(self.site_id, msg.topic, msg.payload)

        except Exception as e:
            logger.error(
                f"[MQTT Connection {self.mqtt_connection_id}] "
                f"Error processing message: {e}"
            )

    def _update_last_heartbeat(self):
        """Aggiorna timestamp ultimo messaggio ricevuto"""
        from mqtt.models import MqttConnection

        try:
            mqtt_conn = MqttConnection.objects.get(id=self.mqtt_connection_id)
            mqtt_conn.last_heartbeat_at = django_tz.now()
            mqtt_conn.save(update_fields=['last_heartbeat_at'])
        except Exception as e:
            logger.error(f"[MQTT Connection {self.mqtt_connection_id}] Error updating heartbeat: {e}")

    def _subscribe_to_topics(self):
        """Sottoscrivi a tutti i topic configurati per questa connessione"""
        from mqtt.models import MqttConnection

        try:
            mqtt_conn = MqttConnection.objects.prefetch_related('topics').get(id=self.mqtt_connection_id)
            active_topics = mqtt_conn.topics.filter(is_active=True)

            self._subscribed_topics = []

            for mqtt_topic in active_topics:
                full_topic = mqtt_topic.get_full_topic()
                qos = mqtt_topic.qos_level

                result = self.client.subscribe(full_topic, qos=qos)
                if result[0] == mqtt.MQTT_ERR_SUCCESS:
                    self._subscribed_topics.append(full_topic)
                    logger.info(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"Subscribed to '{full_topic}' (QoS {qos})"
                    )

                    # Aggiorna statistiche subscription
                    mqtt_topic.subscription_count += 1
                    mqtt_topic.last_subscribed_at = django_tz.now()
                    mqtt_topic.save(update_fields=['subscription_count', 'last_subscribed_at'])
                else:
                    logger.error(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"Failed to subscribe to '{full_topic}'"
                    )

        except Exception as e:
            logger.error(f"[MQTT Connection {self.mqtt_connection_id}] Error subscribing to topics: {e}")

    def connect(self) -> bool:
        """
        Avvia connessione MQTT.

        Returns:
            bool: True se avviata con successo, False altrimenti
        """
        with self._lock:
            # Check reconnect cooldown (prevent code 7 loops)
            if self.reconnect_cooldown_until and datetime.now() < self.reconnect_cooldown_until:
                remaining = (self.reconnect_cooldown_until - datetime.now()).total_seconds()
                logger.info(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"In cooldown period, {remaining:.1f}s remaining"
                )
                return False

            if self.is_running:
                logger.warning(f"[MQTT Connection {self.mqtt_connection_id}] Already running")
                return False

            from mqtt.models import MqttConnection

            try:
                mqtt_conn = MqttConnection.objects.select_related('site').get(id=self.mqtt_connection_id)

                if not mqtt_conn.is_enabled:
                    logger.info(f"[MQTT Connection {self.mqtt_connection_id}] MQTT disabled, skipping")
                    return False

                self.site_id = mqtt_conn.site.id

                # Crea client MQTT con instance ID fisso per unicità tra istanze multiple
                from .mqtt_service import mqtt_service
                from django.conf import settings

                client_id = f"{mqtt_conn.client_id_prefix}_i{mqtt_service.instance_id}"

                # Clean session elimina sessioni zombie sul broker
                clean_session = settings.MQTT_CONFIG.get('CLEAN_SESSION', True)

                logger.info(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Using client ID: {client_id} (clean_session={clean_session})"
                )

                self.client = mqtt.Client(
                    client_id=client_id,
                    clean_session=clean_session,
                    protocol=mqtt.MQTTv311
                )

                # Imposta callbacks
                self.client.on_connect = self._on_connect
                self.client.on_disconnect = self._on_disconnect
                self.client.on_message = self._on_message

                # Credenziali
                if mqtt_conn.username and mqtt_conn.password:
                    self.client.username_pw_set(mqtt_conn.username, mqtt_conn.password)

                # SSL/TLS
                if mqtt_conn.ssl_enabled:
                    import ssl
                    if mqtt_conn.ca_cert_path:
                        # Usa certificato CA personalizzato
                        self.client.tls_set(
                            ca_certs=mqtt_conn.ca_cert_path,
                            cert_reqs=ssl.CERT_REQUIRED,
                            tls_version=ssl.PROTOCOL_TLS
                        )
                    else:
                        # Usa certificati di sistema (default)
                        self.client.tls_set(
                            cert_reqs=ssl.CERT_REQUIRED,
                            tls_version=ssl.PROTOCOL_TLS
                        )
                    logger.info(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"SSL/TLS enabled{' with custom CA' if mqtt_conn.ca_cert_path else ''}"
                    )

                # Last Will and Testament (LWT) - notifica disconnessioni impreviste
                if settings.MQTT_CONFIG.get('LWT_ENABLED', True):
                    lwt_topic = f"{mqtt_conn.client_id_prefix}/backend/status"
                    lwt_payload = json.dumps({
                        "status": "offline",
                        "instance_id": mqtt_service.instance_id,
                        "client_id": client_id,
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "reason": "unexpected_disconnect"
                    })

                    self.client.will_set(
                        topic=lwt_topic,
                        payload=lwt_payload,
                        qos=1,
                        retain=True
                    )

                    logger.info(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"LWT configured: {lwt_topic}"
                    )

                # Keep alive
                keep_alive = mqtt_conn.keep_alive_interval

                # Aggiorna stato a 'connecting'
                self._update_connection_status('connecting')

                # Connetti
                logger.info(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Connecting to {mqtt_conn.broker_host}:{mqtt_conn.broker_port}..."
                )
                self.client.connect(mqtt_conn.broker_host, mqtt_conn.broker_port, keepalive=keep_alive)

                # Avvia loop in thread separato
                self.client.loop_start()
                self.is_running = True

                logger.info(f"[MQTT Connection {self.mqtt_connection_id}] Connection initiated")
                return True

            except Exception as e:
                error_msg = f"Connection error: {str(e)}"
                logger.error(f"[MQTT Connection {self.mqtt_connection_id}] {error_msg}")
                self._update_connection_status('error', error_msg)
                self.retry_count += 1
                return False

    def disconnect(self):
        """Disconnetti MQTT"""
        with self._lock:
            if not self.is_running or not self.client:
                return

            try:
                logger.info(f"[MQTT Connection {self.mqtt_connection_id}] Disconnecting...")

                # Stop loop (non-blocking)
                try:
                    self.client.loop_stop()  # Stops the background thread
                except Exception as e:
                    logger.warning(f"[MQTT Connection {self.mqtt_connection_id}] loop_stop error: {e}")

                # Disconnect (best effort, don't block on network issues)
                try:
                    self.client.disconnect()
                except Exception as e:
                    logger.warning(f"[MQTT Connection {self.mqtt_connection_id}] disconnect error (expected if connection lost): {e}")

                self.is_running = False
                self.retry_count = 0
                self._subscribed_topics = []

                # Update status (handle DB errors gracefully)
                try:
                    self._update_connection_status('disconnected')
                except Exception as e:
                    logger.warning(f"[MQTT Connection {self.mqtt_connection_id}] Could not update DB status: {e}")

                logger.info(f"[MQTT Connection {self.mqtt_connection_id}] Disconnected")
            except Exception as e:
                logger.error(f"[MQTT Connection {self.mqtt_connection_id}] Disconnect error: {e}")

    def is_connected(self) -> bool:
        """Verifica se connesso"""
        return self.is_running and self.client and self.client.is_connected()

    def get_status(self) -> Dict[str, Any]:
        """
        Ottiene stato runtime della connessione.

        Returns:
            Dict con informazioni stato
        """
        return {
            'is_running': self.is_running,
            'is_connected': self.is_connected(),
            'retry_count': self.retry_count,
            'subscribed_topics': len(self._subscribed_topics),
            'topics_list': self._subscribed_topics.copy(),
        }

    def publish_message(self, topic: str, message: str, qos: int = 0) -> Dict[str, Any]:
        """
        Pubblica un messaggio su un topic MQTT.

        Args:
            topic: Topic MQTT
            message: Messaggio da pubblicare
            qos: Quality of Service (0, 1, 2)

        Returns:
            Dict con success e messaggio
        """
        if not self.is_connected():
            return {
                'success': False,
                'message': 'Not connected to MQTT broker'
            }

        try:
            result = self.client.publish(topic, message, qos=qos)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Published to '{topic}' (QoS {qos})"
                )
                return {
                    'success': True,
                    'message': 'Message published successfully',
                    'topic': topic,
                    'qos': qos
                }
            else:
                logger.error(
                    f"[MQTT Connection {self.mqtt_connection_id}] "
                    f"Publish failed with code {result.rc}"
                )
                return {
                    'success': False,
                    'message': f'Publish failed with code {result.rc}'
                }

        except Exception as e:
            error_msg = f"Publish error: {str(e)}"
            logger.error(f"[MQTT Connection {self.mqtt_connection_id}] {error_msg}")
            return {
                'success': False,
                'message': error_msg
            }
