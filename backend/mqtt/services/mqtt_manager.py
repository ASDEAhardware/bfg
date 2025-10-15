import paho.mqtt.client as mqtt
import threading
import time
import logging
import uuid
from typing import Dict, Optional
from django.utils import timezone
from django.conf import settings
from ..models import MqttConnection
from .message_parser import MqttMessageParser

logger = logging.getLogger(__name__)


class MqttClientManager:
    """
    Gestisce connessioni MQTT multiple per tutti i siti
    Singleton pattern per accesso globale
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        # Evita re-inizializzazione del singleton
        if hasattr(self, 'initialized'):
            return

        self.clients: Dict[int, mqtt.Client] = {}  # site_id -> client
        self.running = False
        self._lock = threading.Lock()
        self.reconnect_attempts: Dict[int, int] = {}  # site_id -> attempt count
        self.last_attempt: Dict[int, float] = {}  # site_id -> timestamp
        self.initialized = True

    def start_all_connections(self):
        """Avvia tutte le connessioni MQTT configurate e abilitate"""
        with self._lock:
            connections = MqttConnection.objects.filter(
                is_enabled=True
            ).select_related('site')

            logger.info(f"Starting {connections.count()} MQTT connections...")

            for conn in connections:
                self.start_connection(conn.site.id)
                time.sleep(1)  # Evita connessioni simultanee

    def start_connection(self, site_id: int):
        """Avvia connessione MQTT per un sito specifico"""
        try:
            conn = MqttConnection.objects.select_related('site').get(site_id=site_id)

            # Controlla se la connessione è abilitata
            if not conn.is_enabled:
                logger.info(f"Skipping disabled connection for site {conn.site.name}")
                return

            if site_id in self.clients:
                logger.warning(f"Connection already exists for site {site_id}, stopping existing client")
                self.stop_connection(site_id)

            # Crea client MQTT con ID univoco
            unique_id = str(uuid.uuid4())[:8]
            client_id = f"{conn.client_id_prefix}_{site_id}_{unique_id}"
            client = mqtt.Client(client_id=client_id)

            # Setup callbacks
            client.on_connect = lambda c, ud, flags, rc: self._on_connect(c, ud, flags, rc, site_id)
            client.on_disconnect = lambda c, ud, rc: self._on_disconnect(c, ud, rc, site_id)
            client.on_message = lambda c, ud, msg: self._on_message(c, ud, msg, site_id)

            # Setup credentials
            if conn.username:
                client.username_pw_set(conn.username, conn.password)

            # Setup SSL
            if conn.ssl_enabled:
                if conn.ca_cert_path:
                    client.tls_set(conn.ca_cert_path)
                else:
                    client.tls_set()  # Use default system CA

            # Update status
            conn.status = 'connecting'
            conn.save(update_fields=['status'])

            # Connect
            logger.info(f"Connecting to {conn.broker_host}:{conn.broker_port} for site {conn.site.name}")
            client.connect(conn.broker_host, conn.broker_port, conn.keep_alive_interval)
            client.loop_start()

            self.clients[site_id] = client

        except Exception as e:
            logger.error(f"Error starting connection for site {site_id}: {e}")
            self._handle_connection_error(site_id, str(e))

    def stop_connection(self, site_id: int):
        """Ferma connessione MQTT per un sito specifico"""
        with self._lock:
            if site_id in self.clients:
                client = self.clients[site_id]
                client.loop_stop()
                client.disconnect()
                del self.clients[site_id]
                logger.info(f"Stopped MQTT connection for site {site_id}")

    def stop_all_connections(self):
        """Ferma tutte le connessioni MQTT"""
        with self._lock:
            logger.info("Stopping all MQTT connections...")
            for site_id in list(self.clients.keys()):
                self.stop_connection(site_id)
            self.running = False

    def _should_attempt_reconnection(self, site_id: int) -> bool:
        """Controlla se dovremmo tentare una riconnessione per questo sito"""
        now = time.time()

        # Ottieni numero di tentativi
        attempts = self.reconnect_attempts.get(site_id, 0)
        last_attempt = self.last_attempt.get(site_id, 0)

        # Calcola backoff time (exponential: 1s, 2s, 4s, 8s, max 60s)
        backoff_time = min(2 ** attempts, 60)

        # Se è troppo presto per ritentare
        if now - last_attempt < backoff_time:
            return False

        # Se troppi tentativi (max 10), aspetta 5 minuti
        if attempts >= 10:
            if now - last_attempt < 300:  # 5 minuti
                return False
            else:
                # Reset dopo 5 minuti
                self.reconnect_attempts[site_id] = 0

        return True

    def _record_reconnection_attempt(self, site_id: int):
        """Registra un tentativo di riconnessione"""
        self.reconnect_attempts[site_id] = self.reconnect_attempts.get(site_id, 0) + 1
        self.last_attempt[site_id] = time.time()

    def _reset_reconnection_state(self, site_id: int):
        """Reset stato riconnessione dopo successo"""
        if site_id in self.reconnect_attempts:
            del self.reconnect_attempts[site_id]
        if site_id in self.last_attempt:
            del self.last_attempt[site_id]

    def health_check(self):
        """Controlla salute delle connessioni e riconnette se necessario"""
        try:
            # Controlla connessioni che dovrebbero essere attive ma non lo sono
            active_connections = MqttConnection.objects.filter(
                is_enabled=True,
                status='connected'
            ).exclude(site_id__in=self.clients.keys())

            for conn in active_connections:
                if self._should_attempt_reconnection(conn.site.id):
                    logger.warning(f"Connection {conn.site.name} should be active but client missing, reconnecting...")
                    self._record_reconnection_attempt(conn.site.id)
                    self.start_connection(conn.site.id)
                else:
                    attempts = self.reconnect_attempts.get(conn.site.id, 0)
                    logger.debug(f"Skipping reconnection for {conn.site.name} (attempt {attempts}, backing off)")

            # Controlla heartbeat timeout solo per connessioni abilitate
            timeout_threshold = timezone.now() - timezone.timedelta(minutes=5)
            timed_out_connections = MqttConnection.objects.filter(
                is_enabled=True,
                status='connected',
                last_heartbeat_at__lt=timeout_threshold
            )

            for conn in timed_out_connections:
                logger.warning(f"Heartbeat timeout for {conn.site.name}, marking as error")
                conn.status = 'error'
                conn.error_message = 'Heartbeat timeout'
                conn.save()


        except Exception as e:
            logger.error(f"Error during health check: {e}")

    def _on_connect(self, client, userdata, flags, rc, site_id):
        """Callback connessione riuscita"""
        try:
            if rc == 0:
                conn = MqttConnection.objects.select_related('site').get(site_id=site_id)
                conn.status = 'connected'
                conn.last_connected_at = timezone.now()
                conn.connection_errors = 0
                conn.error_message = ''
                conn.save()

                # Reset reconnection state su successo
                self._reset_reconnection_state(site_id)

                # Subscribe ai topic dal database
                mqtt_topics = conn.topics.filter(is_active=True).order_by('priority')

                # Se non ci sono topic configurati, usa i default
                if not mqtt_topics.exists():
                    # Topic default per retrocompatibilità
                    prefix = conn.client_id_prefix
                    default_topics = [
                        (f"{prefix}/datalogger_o/heartbeat", 0),
                        (f"{prefix}/sys_info", 0)
                    ]
                    for topic, qos in default_topics:
                        result = client.subscribe(topic, qos=qos)
                        logger.info(f"Subscribed to {topic} (default) for site {conn.site.name}, result: {result}")
                else:
                    # Topic dal database
                    for mqtt_topic in mqtt_topics:
                        full_topic = mqtt_topic.get_full_topic()
                        result = client.subscribe(full_topic, qos=mqtt_topic.qos_level)
                        logger.info(f"Subscribed to {full_topic} (QoS {mqtt_topic.qos_level}) for site {conn.site.name}, result: {result}")

                        # Aggiorna statistiche subscription
                        if result[0] == 0:  # Success
                            mqtt_topic.subscription_count += 1
                            mqtt_topic.last_subscribed_at = timezone.now()
                            mqtt_topic.save(update_fields=['subscription_count', 'last_subscribed_at'])

                        # Log subscription errors con retry se configurato
                        if result[0] != 0 and mqtt_topic.auto_retry:
                            logger.warning(f"Subscription failed for {full_topic}, will retry later")


                logger.info(f"Successfully connected to MQTT for site {conn.site.name}")

            else:
                self._handle_connection_error(site_id, f'Connection failed with code {rc}')

        except Exception as e:
            logger.error(f"Error in _on_connect for site {site_id}: {e}")

    def _on_disconnect(self, client, userdata, rc, site_id):
        """Callback disconnessione"""
        try:
            conn = MqttConnection.objects.get(site_id=site_id)

            if rc != 0:
                # Disconnessione inaspettata
                conn.status = 'error'
                conn.connection_errors += 1
                conn.error_message = f'Unexpected disconnection, code: {rc}'


                logger.warning(f"Unexpected disconnection for site {conn.site.name}, code: {rc}")
            else:
                # Disconnessione volontaria
                conn.status = 'disconnected'
                logger.info(f"Clean disconnection for site {conn.site.name}")

            conn.save()

            # Rimuovi client dalla lista
            with self._lock:
                if site_id in self.clients:
                    del self.clients[site_id]

        except Exception as e:
            logger.error(f"Error in _on_disconnect for site {site_id}: {e}")

    def _on_message(self, client, userdata, msg, site_id):
        """Callback ricezione messaggio"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')

            logger.debug(f"Received message on {topic} for site {site_id}: {payload[:100]}...")

            # Parse messaggio in base al topic
            if topic.endswith('/heartbeat'):
                MqttMessageParser.parse_heartbeat(payload, site_id)
            elif topic.endswith('/sys_info'):
                MqttMessageParser.parse_sys_info(payload, site_id)
            else:
                logger.warning(f"Unknown topic {topic} for site {site_id}")

        except Exception as e:
            logger.error(f"Error processing message for site {site_id}: {e}")

    def _handle_connection_error(self, site_id: int, error_message: str):
        """Gestisce errori di connessione"""
        try:
            conn = MqttConnection.objects.get(site_id=site_id)
            conn.status = 'error'
            conn.connection_errors += 1
            conn.error_message = error_message
            conn.save()


            logger.error(f"Connection error for site {conn.site.name}: {error_message}")

            # Rimuovi client se presente
            with self._lock:
                if site_id in self.clients:
                    del self.clients[site_id]

        except Exception as e:
            logger.error(f"Error handling connection error for site {site_id}: {e}")

    def restart_all_connections(self):
        """Riavvia tutte le connessioni MQTT"""
        logger.info("Restarting all MQTT connections...")

        # Stop tutto
        self.stop_all_connections()

        # Aspetta un momento
        import time
        time.sleep(2)

        # Reset stato riconnessioni
        self.reconnect_attempts.clear()
        self.last_attempt.clear()

        # Disconnetti eventuali connessioni disabilitate
        self._disconnect_disabled_connections()

        # Riavvia tutto
        self.start_all_connections()

        logger.info("All MQTT connections restarted")

    def _disconnect_disabled_connections(self):
        """Disconnetti connessioni che sono state disabilitate"""
        disabled_connections = MqttConnection.objects.filter(is_enabled=False)
        for conn in disabled_connections:
            if conn.site.id in self.clients:
                logger.info(f"Disconnecting disabled connection for site {conn.site.name}")
                self.stop_connection(conn.site.id)
                # Aggiorna status nel database
                conn.status = 'disabled'
                conn.save(update_fields=['status'])

    def get_connection_status(self):
        """Restituisce stato di tutte le connessioni"""
        status = {
            'total_configured': MqttConnection.objects.count(),
            'enabled_connections': MqttConnection.objects.filter(is_enabled=True).count(),
            'disabled_connections': MqttConnection.objects.filter(is_enabled=False).count(),
            'active_clients': len(self.clients),
            'connected': MqttConnection.objects.filter(is_enabled=True, status='connected').count(),
            'errors': MqttConnection.objects.filter(is_enabled=True, status='error').count(),
            'disconnected': MqttConnection.objects.filter(is_enabled=True, status='disconnected').count(),
            'running': self.running,
        }
        return status

    @classmethod
    def get_instance(cls):
        """Ottieni istanza singleton del manager"""
        return cls()