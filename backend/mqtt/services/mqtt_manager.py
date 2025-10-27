"""
MQTT Manager - Singleton che gestisce tutte le connessioni MQTT
"""
import logging
import threading
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from ..models import MqttConnection
from .connection_handler import MqttConnectionHandler
from .message_processor import message_processor

logger = logging.getLogger(__name__)


class MqttManager:
    """
    Singleton Manager che gestisce tutte le connessioni MQTT attive.
    Thread-safe per uso in ambiente Django.
    """

    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # Registry delle connessioni attive
        self._connections: Dict[int, MqttConnectionHandler] = {}
        self._connections_lock = threading.RLock()

        # Stato manager
        self._is_running = False
        self._should_stop = False

        # Message callback globale
        self._message_callback: Optional[Callable] = None

        # Monitoring thread
        self._monitoring_thread: Optional[threading.Thread] = None

        self._initialized = True
        logger.info("MQTT Manager initialized")

    def start(self) -> bool:
        """
        Avvia il manager e carica tutte le connessioni abilitate.

        Returns:
            bool: True se avviato con successo
        """
        with self._lock:
            if self._is_running:
                logger.warning("MQTT Manager already running")
                return True

            logger.info("Starting MQTT Manager...")

            self._should_stop = False
            self._is_running = True

            # Carica e avvia tutte le connessioni abilitate
            enabled_connections = self._load_enabled_connections()
            logger.info(f"Found {len(enabled_connections)} enabled MQTT connections")

            success_count = 0
            for conn_id in enabled_connections:
                if self._start_connection_internal(conn_id):
                    success_count += 1

            # Avvia monitoring thread
            self._monitoring_thread = threading.Thread(
                target=self._monitoring_worker,
                name="mqtt-manager-monitor",
                daemon=True
            )
            self._monitoring_thread.start()

            logger.info(f"MQTT Manager started: {success_count}/{len(enabled_connections)} connections active")
            return True

    def stop(self) -> bool:
        """
        Ferma il manager e tutte le connessioni.

        Returns:
            bool: True se fermato con successo
        """
        with self._lock:
            if not self._is_running:
                logger.warning("MQTT Manager not running")
                return True

            logger.info("Stopping MQTT Manager...")

            self._should_stop = True
            self._is_running = False

            # Ferma tutte le connessioni
            connection_ids = list(self._connections.keys())
            for conn_id in connection_ids:
                self._stop_connection_internal(conn_id)

            # Aspetta che il monitoring thread termini
            if self._monitoring_thread and self._monitoring_thread.is_alive():
                self._monitoring_thread.join(timeout=10.0)
                if self._monitoring_thread.is_alive():
                    logger.warning("Monitoring thread did not terminate cleanly")

            logger.info("MQTT Manager stopped")
            return True

    def start_connection(self, site_id: int, manual: bool = True) -> Dict[str, Any]:
        """
        Avvia connessione MQTT per un sito specifico.

        Args:
            site_id: ID del sito
            manual: Se True, bypassa backoff delay

        Returns:
            Dict con risultato operazione
        """
        try:
            # Trova connessione per il sito
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            # Verifica se abilitata
            if not mqtt_conn.is_enabled:
                # Abilita automaticamente se richiesta manuale
                if manual:
                    mqtt_conn.is_enabled = True
                    mqtt_conn.save(update_fields=['is_enabled'])
                    logger.info(f"Auto-enabled MQTT connection for site {site_id}")
                else:
                    return {
                        'success': False,
                        'message': f'MQTT connection for site {site_id} is disabled'
                    }

            # Avvia connessione
            success = self._start_connection_internal(mqtt_conn.id, manual=manual)

            if success:
                return {
                    'success': True,
                    'message': f'MQTT connection started for site {site_id}',
                    'connection_id': mqtt_conn.id
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to start MQTT connection for site {site_id}'
                }

        except MqttConnection.DoesNotExist:
            return {
                'success': False,
                'message': f'No MQTT connection configured for site {site_id}'
            }
        except Exception as e:
            logger.error(f"Error starting connection for site {site_id}: {e}")
            return {
                'success': False,
                'message': f'Error starting connection: {str(e)}'
            }

    def stop_connection(self, site_id: int) -> Dict[str, Any]:
        """
        Ferma connessione MQTT per un sito specifico.

        Args:
            site_id: ID del sito

        Returns:
            Dict con risultato operazione
        """
        try:
            # Trova connessione per il sito
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            # Disabilita nel DB
            mqtt_conn.is_enabled = False
            mqtt_conn.save(update_fields=['is_enabled'])

            # Ferma connessione attiva
            success = self._stop_connection_internal(mqtt_conn.id)

            if success:
                return {
                    'success': True,
                    'message': f'MQTT connection stopped for site {site_id}',
                    'connection_id': mqtt_conn.id
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to stop MQTT connection for site {site_id}'
                }

        except MqttConnection.DoesNotExist:
            return {
                'success': False,
                'message': f'No MQTT connection configured for site {site_id}'
            }
        except Exception as e:
            logger.error(f"Error stopping connection for site {site_id}: {e}")
            return {
                'success': False,
                'message': f'Error stopping connection: {str(e)}'
            }

    def get_connection_status(self, site_id: int) -> Optional[Dict[str, Any]]:
        """
        Ottiene stato connessione per un sito.

        Args:
            site_id: ID del sito

        Returns:
            Dict con stato connessione o None se non trovata
        """
        try:
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            # Stato dal DB
            db_status = {
                'connection_id': mqtt_conn.id,
                'site_id': site_id,
                'site_name': mqtt_conn.site.name,
                'is_enabled': mqtt_conn.is_enabled,
                'status': mqtt_conn.status,
                'broker_host': mqtt_conn.broker_host,
                'broker_port': mqtt_conn.broker_port,
                'last_connected_at': mqtt_conn.last_connected_at.isoformat() if mqtt_conn.last_connected_at else None,
                'last_heartbeat_at': mqtt_conn.last_heartbeat_at.isoformat() if mqtt_conn.last_heartbeat_at else None,
                'connection_errors': mqtt_conn.connection_errors,
                'error_message': mqtt_conn.error_message,
            }

            # Stato runtime dal handler
            with self._connections_lock:
                handler = self._connections.get(mqtt_conn.id)
                if handler:
                    runtime_status = handler.get_status()
                    db_status.update({
                        'handler_running': runtime_status['is_running'],
                        'handler_connected': runtime_status['is_connected'],
                        'retry_count': runtime_status['retry_count'],
                        'subscribed_topics': runtime_status['subscribed_topics'],
                    })
                else:
                    db_status.update({
                        'handler_running': False,
                        'handler_connected': False,
                        'retry_count': 0,
                        'subscribed_topics': 0,
                    })

            return db_status

        except MqttConnection.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting connection status for site {site_id}: {e}")
            return None

    def get_all_connections_status(self) -> List[Dict[str, Any]]:
        """
        Ottiene stato di tutte le connessioni MQTT.

        Returns:
            Lista con stato di tutte le connessioni
        """
        try:
            all_connections = MqttConnection.objects.select_related('site').all()
            status_list = []

            for mqtt_conn in all_connections:
                site_status = self.get_connection_status(mqtt_conn.site.id)
                if site_status:
                    status_list.append(site_status)

            return status_list

        except Exception as e:
            logger.error(f"Error getting all connections status: {e}")
            return []

    def set_message_callback(self, callback: Callable):
        """
        Imposta callback globale per i messaggi MQTT ricevuti.

        Args:
            callback: Funzione che riceve (site_id, topic, payload, qos, retain)
        """
        self._message_callback = callback
        logger.info("Global MQTT message callback set")

    def is_running(self) -> bool:
        """
        Verifica se il manager è in esecuzione.

        Returns:
            bool: True se in esecuzione
        """
        return self._is_running

    def _load_enabled_connections(self) -> List[int]:
        """
        Carica tutte le connessioni MQTT abilitate dal DB.

        Returns:
            Lista degli ID delle connessioni abilitate
        """
        try:
            enabled_connections = MqttConnection.objects.filter(
                is_enabled=True
            ).values_list('id', flat=True)
            return list(enabled_connections)
        except Exception as e:
            logger.error(f"Error loading enabled connections: {e}")
            return []

    def _start_connection_internal(self, connection_id: int, manual: bool = False) -> bool:
        """
        Avvia una connessione specifica (uso interno).

        Args:
            connection_id: ID della connessione MQTT
            manual: Se True, bypassa backoff delay

        Returns:
            bool: True se avviata con successo
        """
        with self._connections_lock:
            # Se già presente, fermala prima
            if connection_id in self._connections:
                logger.info(f"Stopping existing connection {connection_id} before restart")
                self._stop_connection_internal(connection_id)

            # Crea nuovo handler
            handler = MqttConnectionHandler(
                mqtt_connection_id=connection_id,
                message_callback=self._global_message_callback
            )

            # Avvia handler
            success = handler.start(manual=manual)
            if success:
                self._connections[connection_id] = handler
                logger.info(f"Started MQTT connection handler {connection_id}")
                return True
            else:
                logger.error(f"Failed to start MQTT connection handler {connection_id}")
                return False

    def _stop_connection_internal(self, connection_id: int) -> bool:
        """
        Ferma una connessione specifica (uso interno).

        Args:
            connection_id: ID della connessione MQTT

        Returns:
            bool: True se fermata con successo
        """
        with self._connections_lock:
            handler = self._connections.pop(connection_id, None)
            if handler:
                success = handler.stop()
                logger.info(f"Stopped MQTT connection handler {connection_id}")
                return success
            else:
                logger.warning(f"No active handler found for connection {connection_id}")
                return True

    def _global_message_callback(self, site_id: int, topic: str, payload: bytes, qos: int, retain: bool):
        """
        Callback globale per messaggi MQTT ricevuti.

        Args:
            site_id: ID del sito
            topic: Topic MQTT
            payload: Payload del messaggio
            qos: Quality of Service
            retain: Flag retain
        """
        try:
            # Log base
            logger.debug(f"MQTT message from site {site_id}: {topic} ({len(payload)} bytes)")

            # Processa messaggio con message processor
            processed = message_processor.process_message(site_id, topic, payload, qos, retain)
            if processed:
                logger.debug(f"Message processed successfully: {topic}")
            else:
                logger.debug(f"Message not processed (unknown type): {topic}")

            # Chiama callback esterno se configurato
            if self._message_callback:
                self._message_callback(site_id, topic, payload, qos, retain)

        except Exception as e:
            logger.error(f"Error in global message callback: {e}")

    def _monitoring_worker(self):
        """
        Worker thread per monitoring delle connessioni.
        Verifica periodicamente lo stato e riavvia connessioni morte.
        """
        logger.info("MQTT Manager monitoring started")

        while not self._should_stop:
            try:
                # Ogni 30 secondi controlla le connessioni
                import time
                time.sleep(30)

                if self._should_stop:
                    break

                self._check_and_restart_failed_connections()

                # Controlla dispositivi offline ogni ciclo di monitoring
                message_processor.check_offline_devices()

            except Exception as e:
                logger.error(f"Error in monitoring worker: {e}")

        logger.info("MQTT Manager monitoring stopped")

    def _check_and_restart_failed_connections(self):
        """
        Controlla e riavvia connessioni fallite.
        """
        try:
            # Trova connessioni che dovrebbero essere attive ma non lo sono
            enabled_connections = self._load_enabled_connections()

            with self._connections_lock:
                for conn_id in enabled_connections:
                    handler = self._connections.get(conn_id)

                    if not handler:
                        # Connessione abilitata ma nessun handler → avvia
                        logger.info(f"Restarting missing connection {conn_id}")
                        self._start_connection_internal(conn_id)

                    elif handler.is_running and not handler.is_connected:
                        # Handler running ma non connesso → normale se in retry
                        status = handler.get_status()
                        logger.debug(f"Connection {conn_id} in retry: attempt {status['retry_count']}")

                # Rimuovi handler per connessioni disabilitate
                active_conn_ids = list(self._connections.keys())
                for conn_id in active_conn_ids:
                    if conn_id not in enabled_connections:
                        logger.info(f"Stopping disabled connection {conn_id}")
                        self._stop_connection_internal(conn_id)

        except Exception as e:
            logger.error(f"Error checking failed connections: {e}")

    def publish_message(self, site_id: int, topic: str, message: str, qos: int = 0) -> Dict[str, Any]:
        """
        Pubblica un messaggio MQTT su un topic specifico per un sito.

        Args:
            site_id: ID del sito
            topic: Topic MQTT su cui pubblicare
            message: Messaggio da pubblicare
            qos: Quality of Service (0, 1, 2)

        Returns:
            Dict con success e messaggio
        """
        with self._connections_lock:
            handler = self._connections.get(site_id)

            if not handler:
                return {
                    'success': False,
                    'message': f'No MQTT connection found for site {site_id}'
                }

            if not handler.is_connected:
                return {
                    'success': False,
                    'message': f'MQTT connection for site {site_id} is not connected'
                }

            return handler.publish_message(topic, message, qos)

    def subscribe_topic(self, site_id: int, topic: str, callback_url: str = None) -> Dict[str, Any]:
        """
        Sottoscrivi a un topic MQTT per un sito specifico.

        Args:
            site_id: ID del sito
            topic: Topic MQTT da sottoscrivere
            callback_url: URL di callback per notifiche (opzionale)

        Returns:
            Dict con success e messaggio
        """
        with self._connections_lock:
            handler = self._connections.get(site_id)

            if not handler:
                return {
                    'success': False,
                    'message': f'No MQTT connection found for site {site_id}'
                }

            if not handler.is_connected:
                return {
                    'success': False,
                    'message': f'MQTT connection for site {site_id} is not connected'
                }

            # Per ora assumiamo che la sottoscrizione avvenga automaticamente
            # In futuro si potrebbe implementare sottoscrizione dinamica
            return {
                'success': True,
                'message': f'Subscription to {topic} will be handled automatically'
            }


# Singleton instance
mqtt_manager = MqttManager()