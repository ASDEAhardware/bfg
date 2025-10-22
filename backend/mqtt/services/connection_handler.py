"""
MQTT Connection Handler - Gestisce una singola connessione MQTT per un sito
"""
import time
import logging
import threading
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta

import paho.mqtt.client as mqtt
from django.utils import timezone
from django.db import transaction

from ..models import MqttConnection

logger = logging.getLogger(__name__)


class MqttConnectionHandler:
    """
    Gestisce una singola connessione MQTT per un sito specifico.
    Thread-safe con auto-reconnect e backoff esponenziale.
    """

    def __init__(self, mqtt_connection_id: int, message_callback: Optional[Callable] = None):
        self.mqtt_connection_id = mqtt_connection_id
        self.message_callback = message_callback

        # MQTT client
        self.client: Optional[mqtt.Client] = None
        self.is_running = False
        self.is_connected = False
        self.should_stop = False

        # Threading
        self._lock = threading.RLock()
        self._connection_thread: Optional[threading.Thread] = None

        # Reconnection logic
        self.retry_count = 0
        self.max_retry_delay = 300  # 5 minuti max
        self.base_retry_delay = 5   # 5 secondi base
        self.last_connection_attempt = None

        # Connection config (loaded from DB)
        self._config: Optional[Dict[str, Any]] = None
        self._subscribed_topics = set()

    def start(self, manual: bool = False) -> bool:
        """
        Avvia la connessione MQTT.

        Args:
            manual: Se True, bypassa il backoff delay (comando manuale)

        Returns:
            bool: True se avviato con successo
        """
        with self._lock:
            if self.is_running:
                logger.warning(f"Connection {self.mqtt_connection_id} already running")
                return True

            # Reset retry count se comando manuale
            if manual:
                self.retry_count = 0
                logger.info(f"Manual start - resetting retry count for connection {self.mqtt_connection_id}")

            # Carica configurazione dal DB
            if not self._load_config():
                return False

            # Check backoff delay (solo se non manuale)
            if not manual and not self._can_attempt_connection():
                logger.info(f"Connection {self.mqtt_connection_id} in backoff period")
                return False

            self.should_stop = False
            self.is_running = True

            # Avvia thread di connessione
            self._connection_thread = threading.Thread(
                target=self._connection_worker,
                name=f"mqtt-conn-{self.mqtt_connection_id}",
                daemon=True
            )
            self._connection_thread.start()

            logger.info(f"Started MQTT connection handler for site {self._config['site_id']}")
            return True

    def stop(self) -> bool:
        """
        Ferma la connessione MQTT.

        Returns:
            bool: True se fermato con successo
        """
        with self._lock:
            if not self.is_running:
                logger.warning(f"Connection {self.mqtt_connection_id} not running")
                return True

            logger.info(f"Stopping MQTT connection {self.mqtt_connection_id}")

            self.should_stop = True
            self.is_running = False

            # Disconnetti client MQTT
            if self.client:
                try:
                    if self.is_connected:
                        self.client.disconnect()
                    # Ferma loop paho-mqtt
                    self.client.loop_stop()
                    logger.info(f"MQTT client {self.mqtt_connection_id} disconnected and loop stopped")
                except Exception as e:
                    logger.error(f"Error disconnecting MQTT client {self.mqtt_connection_id}: {e}")

            # Aspetta che il thread termini (max 5 secondi)
            if self._connection_thread and self._connection_thread.is_alive():
                self._connection_thread.join(timeout=5.0)
                if self._connection_thread.is_alive():
                    logger.warning(f"Connection thread {self.mqtt_connection_id} did not terminate cleanly")

            # Aggiorna stato nel DB
            self._update_connection_status('disconnected')

            return True

    def get_status(self) -> Dict[str, Any]:
        """
        Ritorna lo stato corrente della connessione.

        Returns:
            Dict con informazioni di stato
        """
        with self._lock:
            return {
                'is_running': self.is_running,
                'is_connected': self.is_connected,
                'retry_count': self.retry_count,
                'subscribed_topics': len(self._subscribed_topics),
                'last_attempt': self.last_connection_attempt.isoformat() if self.last_connection_attempt else None,
                'config_loaded': self._config is not None
            }

    def _load_config(self) -> bool:
        """
        Carica la configurazione dal database.

        Returns:
            bool: True se caricata con successo
        """
        try:
            mqtt_conn = MqttConnection.objects.select_related('site').get(
                id=self.mqtt_connection_id,
                is_enabled=True
            )

            self._config = {
                'site_id': mqtt_conn.site.id,
                'site_name': mqtt_conn.site.name,
                'site_code': mqtt_conn.client_id_prefix,  # Usa sempre client_id_prefix
                'broker_host': mqtt_conn.broker_host,
                'broker_port': mqtt_conn.broker_port,
                'username': mqtt_conn.username,
                'password': mqtt_conn.password,
                'client_id_prefix': mqtt_conn.client_id_prefix,  # Manteniamo per client ID
                'keep_alive_interval': mqtt_conn.keep_alive_interval,
                'ssl_enabled': mqtt_conn.ssl_enabled,
                'ca_cert_path': mqtt_conn.ca_cert_path,
                'retry_attempts': mqtt_conn.retry_attempts,
                'retry_delay': mqtt_conn.retry_delay,
                'max_retry_delay': mqtt_conn.max_retry_delay,
            }

            # Aggiorna valori locali
            self.base_retry_delay = mqtt_conn.retry_delay
            self.max_retry_delay = mqtt_conn.max_retry_delay

            logger.debug(f"Loaded config for site {self._config['site_name']} ({self._config['site_id']})")
            return True

        except MqttConnection.DoesNotExist:
            logger.error(f"MQTT connection {self.mqtt_connection_id} not found or disabled")
            return False
        except Exception as e:
            logger.error(f"Error loading MQTT config {self.mqtt_connection_id}: {e}")
            return False

    def _can_attempt_connection(self) -> bool:
        """
        Verifica se può tentare una connessione (rispetta backoff).

        Returns:
            bool: True se può tentare
        """
        if not self.last_connection_attempt:
            return True

        # Calcola delay attuale con backoff esponenziale
        current_delay = min(
            self.base_retry_delay * (2 ** self.retry_count),
            self.max_retry_delay
        )

        time_since_last = (datetime.now() - self.last_connection_attempt).total_seconds()
        return time_since_last >= current_delay

    def _connection_worker(self):
        """
        Worker thread che gestisce la connessione MQTT.
        """
        # Singolo tentativo di connessione iniziale - paho-mqtt gestisce auto-reconnect
        try:
            if not self.is_connected:
                success = self._attempt_connection()
                if success:
                    self.retry_count = 0  # Reset retry su successo
                    # Mantieni connessione attiva - paho-mqtt gestisce riconnessioni
                    self._maintain_connection()
                else:
                    logger.error(f"Initial connection failed for {self.mqtt_connection_id}")
                    self._update_connection_status('error', 'Initial connection failed')

        except Exception as e:
            logger.error(f"Error in connection worker {self.mqtt_connection_id}: {e}")
            self._update_connection_status('error', str(e))

        logger.info(f"Connection worker {self.mqtt_connection_id} terminated")

    def _attempt_connection(self) -> bool:
        """
        Tenta di stabilire connessione MQTT.

        Returns:
            bool: True se connessione riuscita
        """
        if not self._config:
            logger.error(f"No config loaded for connection {self.mqtt_connection_id}")
            return False

        try:
            # Crea nuovo client MQTT
            client_id = f"{self._config['client_id_prefix']}_manager_{self.mqtt_connection_id}"
            self.client = mqtt.Client(client_id=client_id)

            # Configura auto-reconnect paho-mqtt (evita loop infiniti)
            self.client.reconnect_delay_set(min_delay=self._config['retry_delay'], max_delay=self._config['max_retry_delay'])

            # Configura callbacks
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message
            self.client.on_subscribe = self._on_subscribe

            # Configura credenziali
            if self._config['username']:
                self.client.username_pw_set(
                    self._config['username'],
                    self._config['password']
                )

            # Configura SSL se abilitato
            if self._config['ssl_enabled']:
                if self._config['ca_cert_path']:
                    self.client.tls_set(ca_certs=self._config['ca_cert_path'])
                else:
                    self.client.tls_set()

            # Tenta connessione
            self._update_connection_status('connecting')

            result = self.client.connect(
                self._config['broker_host'],
                self._config['broker_port'],
                self._config['keep_alive_interval']
            )

            if result == mqtt.MQTT_ERR_SUCCESS:
                # Avvia loop in thread separato
                self.client.loop_start()
                return True
            else:
                logger.error(f"MQTT connect failed for {self.mqtt_connection_id}: {mqtt.error_string(result)}")
                self._update_connection_status('error', f"Connect failed: {mqtt.error_string(result)}")
                return False

        except Exception as e:
            logger.error(f"Exception during MQTT connection {self.mqtt_connection_id}: {e}")
            self._update_connection_status('error', str(e))
            return False

    def _maintain_connection(self):
        """
        Mantiene la connessione attiva finché non viene fermata.
        """
        while not self.should_stop and self.is_connected:
            time.sleep(1)  # Check ogni secondo

    def _on_connect(self, client, userdata, flags, rc):
        """Callback connessione stabilita."""
        if rc == 0:
            self.is_connected = True
            logger.info(f"MQTT connected: {self._config['site_name']} ({self.mqtt_connection_id})")

            # Sottoscrivi al topic pattern principale usando site code
            topic_pattern = f"{self._config['site_code']}/#"
            client.subscribe(topic_pattern, qos=0)

            self._update_connection_status('connected')

        else:
            logger.error(f"MQTT connection failed {self.mqtt_connection_id}: {mqtt.connack_string(rc)}")
            self._update_connection_status('error', f"Connection failed: {mqtt.connack_string(rc)}")

    def _on_disconnect(self, client, userdata, rc):
        """Callback disconnessione."""
        self.is_connected = False
        self._subscribed_topics.clear()

        if rc != 0:
            logger.warning(f"MQTT unexpected disconnect {self.mqtt_connection_id}: {mqtt.error_string(rc)}")
        else:
            logger.info(f"MQTT disconnected cleanly: {self.mqtt_connection_id}")

        if not self.should_stop:
            self._update_connection_status('disconnected')

    def _on_subscribe(self, client, userdata, mid, granted_qos):
        """Callback subscription confermata."""
        logger.debug(f"MQTT subscribed {self.mqtt_connection_id}: mid={mid}, qos={granted_qos}")

    def _on_message(self, client, userdata, msg):
        """Callback messaggio ricevuto."""
        try:
            logger.debug(f"MQTT message {self.mqtt_connection_id}: {msg.topic} = {len(msg.payload)} bytes")

            # Chiama callback esterno se configurato
            if self.message_callback:
                self.message_callback(
                    site_id=self._config['site_id'],
                    topic=msg.topic,
                    payload=msg.payload,
                    qos=msg.qos,
                    retain=msg.retain
                )

        except Exception as e:
            logger.error(f"Error processing MQTT message {self.mqtt_connection_id}: {e}")

    def _update_connection_status(self, status: str, error_message: str = ""):
        """
        Aggiorna lo stato della connessione nel database.

        Args:
            status: Nuovo stato
            error_message: Messaggio di errore opzionale
        """
        try:
            with transaction.atomic():
                mqtt_conn = MqttConnection.objects.get(id=self.mqtt_connection_id)
                mqtt_conn.status = status

                if status == 'connected':
                    mqtt_conn.last_connected_at = timezone.now()
                    mqtt_conn.last_heartbeat_at = timezone.now()
                    mqtt_conn.connection_errors = 0
                    mqtt_conn.error_message = ""
                elif status == 'error':
                    mqtt_conn.connection_errors += 1
                    mqtt_conn.error_message = error_message
                elif status == 'disconnected':
                    mqtt_conn.error_message = ""

                mqtt_conn.save(update_fields=[
                    'status', 'last_connected_at', 'last_heartbeat_at',
                    'connection_errors', 'error_message', 'updated_at'
                ])

        except Exception as e:
            logger.error(f"Error updating connection status {self.mqtt_connection_id}: {e}")