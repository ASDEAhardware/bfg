"""
MQTT Service - Singleton che gestisce tutte le connessioni MQTT
"""
import logging
import os
import socket
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from django.db.models import Q
from django.utils import timezone

from mqtt.models import MqttConnection
from mqtt.services.mqtt_connection import MQTTConnectionManager

logger = logging.getLogger(__name__)


class MQTTService:
    """Singleton che gestisce tutte le connessioni MQTT"""

    _instance = None
    _lock = threading.Lock()

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

        # Instance ID - basato su hostname container (fisso tra restart del processo)
        # Usato per garantire client_id MQTT unici tra istanze multiple
        # Permette client takeover sul broker in caso di restart
        self.instance_id = os.getenv(
            'MQTT_INSTANCE_ID',
            socket.gethostname()[:8]  # Limita a 8 char per compatibilità
        )

        # Registry delle connessioni attive {mqtt_connection_id: MQTTConnectionManager}
        self.connections: Dict[int, MQTTConnectionManager] = {}
        self._connections_lock = threading.RLock()

        # Stato service
        self.running = False
        self._should_stop = False

        # Monitor thread
        self.monitor_thread: Optional[threading.Thread] = None

        self._initialized = True
        logger.info(f"MQTT Service initialized (instance: {self.instance_id})")

    def process_message(self, site_id: int, topic: str, payload: bytes):
        """
        Callback per processare messaggi MQTT.
        Delega al message_processor esistente.

        Args:
            site_id: ID del sito
            topic: Topic MQTT
            payload: Payload del messaggio (bytes)
        """
        try:
            # Importa il message_processor esistente
            from mqtt.services.message_processor import message_processor

            # Converti payload in stringa se necessario
            if isinstance(payload, bytes):
                payload_str = payload.decode('utf-8', errors='ignore')
            else:
                payload_str = str(payload)

            # Chiama il processore esistente
            # Nota: adatta i parametri se necessario
            processed = message_processor.process_message(
                site_id=site_id,
                topic=topic,
                payload=payload_str,
                qos=0,  # Non abbiamo QoS nel callback, usa default
                retain=False  # Non abbiamo retain nel callback, usa default
            )

            if processed:
                logger.debug(f"[Site {site_id}] Message processed: {topic}")
            else:
                logger.debug(f"[Site {site_id}] Message not processed (unknown type): {topic}")

        except Exception as e:
            logger.error(f"[Site {site_id}] Error processing message from {topic}: {e}")

    def start_connection(self, site_id: int, manual: bool = True) -> Dict[str, Any]:
        """
        Avvia connessione MQTT per un sito specifico.

        Args:
            site_id: ID del sito
            manual: Se True, abilita automaticamente se disabilitata

        Returns:
            Dict con risultato operazione
        """
        try:
            mqtt_conn = MqttConnection.objects.select_related('site').get(site_id=site_id)

            # Se disabilitata e richiesta manuale, abilita
            if not mqtt_conn.is_enabled and manual:
                mqtt_conn.is_enabled = True
                mqtt_conn.save(update_fields=['is_enabled'])
                logger.info(f"[Site {site_id}] Auto-enabled MQTT connection")

            if not mqtt_conn.is_enabled:
                return {
                    'success': False,
                    'message': f'MQTT connection for site {site_id} is disabled'
                }

            # Ferma connessione esistente se presente
            with self._connections_lock:
                if mqtt_conn.id in self.connections:
                    logger.info(f"[Site {site_id}] Stopping existing connection before restart")
                    self.stop_connection(site_id)

                # Crea nuovo manager
                manager = MQTTConnectionManager(mqtt_conn.id, self.process_message)

                # Avvia connessione
                success = manager.connect()

                if success:
                    self.connections[mqtt_conn.id] = manager
                    logger.info(f"[Site {site_id}] Connection started")
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
            logger.error(f"[Site {site_id}] Error starting connection: {e}")
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
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            # Disabilita nel DB
            mqtt_conn.is_enabled = False
            mqtt_conn.save(update_fields=['is_enabled'])

            # Ferma connessione attiva
            with self._connections_lock:
                manager = self.connections.pop(mqtt_conn.id, None)
                if manager:
                    manager.disconnect()
                    logger.info(f"[Site {site_id}] Connection stopped")

            return {
                'success': True,
                'message': f'MQTT connection stopped for site {site_id}',
                'connection_id': mqtt_conn.id
            }

        except MqttConnection.DoesNotExist:
            return {
                'success': False,
                'message': f'No MQTT connection configured for site {site_id}'
            }
        except Exception as e:
            logger.error(f"[Site {site_id}] Error stopping connection: {e}")
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
            mqtt_conn = MqttConnection.objects.select_related('site').get(site_id=site_id)

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
                'mqtt_retry_count': mqtt_conn.mqtt_retry_count,
                'mqtt_next_retry': mqtt_conn.mqtt_next_retry.isoformat() if mqtt_conn.mqtt_next_retry else None,
            }

            # Stato runtime dal manager
            with self._connections_lock:
                manager = self.connections.get(mqtt_conn.id)
                if manager:
                    runtime_status = manager.get_status()
                    db_status.update({
                        'handler_running': runtime_status['is_running'],
                        'handler_connected': runtime_status['is_connected'],
                        'retry_count': runtime_status['retry_count'],
                        'subscribed_topics': runtime_status['subscribed_topics'],
                        'topics_list': runtime_status['topics_list'],
                    })
                else:
                    db_status.update({
                        'handler_running': False,
                        'handler_connected': False,
                        'retry_count': 0,
                        'subscribed_topics': 0,
                        'topics_list': [],
                    })

            return db_status

        except MqttConnection.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"[Site {site_id}] Error getting connection status: {e}")
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

    def start_all(self):
        """Avvia tutte le connessioni MQTT abilitate"""
        try:
            enabled_connections = MqttConnection.objects.filter(is_enabled=True).select_related('site')
            logger.info(f"Starting MQTT for {enabled_connections.count()} enabled connections")

            for mqtt_conn in enabled_connections:
                self.start_connection(mqtt_conn.site.id, manual=False)

        except Exception as e:
            logger.error(f"Error starting all connections: {e}")

    def monitor_connections(self):
        """Thread che monitora e riavvia connessioni"""
        logger.info("MQTT Monitor started")

        # Grace period to prevent false "lost connection" detection during initial connection
        GRACE_PERIOD_SECONDS = 15

        while not self._should_stop:
            try:
                # Controlla connessioni esistenti
                with self._connections_lock:
                    connection_ids = list(self.connections.keys())

                for conn_id in connection_ids:
                    manager = self.connections.get(conn_id)
                    if manager and not manager.is_connected():
                        try:
                            # Check if connection is still establishing (grace period)
                            connection_age = (datetime.now() - manager.created_at).total_seconds()

                            if connection_age < GRACE_PERIOD_SECONDS:
                                # Connection is still establishing, don't retry yet
                                logger.debug(
                                    f"[Connection {conn_id}] Not connected yet, "
                                    f"but only {connection_age:.1f}s old. "
                                    f"Waiting (grace period: {GRACE_PERIOD_SECONDS}s)..."
                                )
                                continue

                            mqtt_conn = MqttConnection.objects.get(id=conn_id)
                            logger.warning(
                                f"[Connection {conn_id}] Lost connection (age: {connection_age:.1f}s), "
                                f"retry {manager.retry_count}/{manager.MAX_RETRIES}"
                            )

                            # Se non ha superato max retry, riprova
                            if manager.retry_count < manager.MAX_RETRIES and mqtt_conn.is_enabled:
                                # Disconnetti completamente il vecchio manager per fermare loop paho-mqtt
                                logger.debug(f"[Connection {conn_id}] Disconnecting old manager before retry")
                                manager.disconnect()

                                # Rimuovi manager vecchio dal registry
                                with self._connections_lock:
                                    self.connections.pop(conn_id, None)

                                # Avvia nuovo tentativo (il nuovo manager leggerà retry_count dal DB)
                                self.start_connection(mqtt_conn.site.id, manual=False)

                        except Exception as e:
                            logger.error(f"[Connection {conn_id}] Error handling lost connection: {e}")

                # Cerca nuovi siti abilitati o quelli da retry
                now = timezone.now()
                sites_to_check = MqttConnection.objects.filter(
                    is_enabled=True
                ).exclude(
                    id__in=list(self.connections.keys())
                ).filter(
                    Q(mqtt_next_retry__isnull=True) | Q(mqtt_next_retry__lte=now)
                ).select_related('site')

                for mqtt_conn in sites_to_check:
                    logger.info(
                        f"[Site {mqtt_conn.site.id}] Attempting connection "
                        f"(retry {mqtt_conn.mqtt_retry_count} or new)"
                    )
                    self.start_connection(mqtt_conn.site.id, manual=False)

                # Pulizia: rimuovi connessioni per siti disabilitati
                disabled_connections = MqttConnection.objects.filter(
                    id__in=list(self.connections.keys()),
                    is_enabled=False
                )

                for mqtt_conn in disabled_connections:
                    logger.info(f"[Site {mqtt_conn.site.id}] MQTT disabled, stopping connection")
                    self.stop_connection(mqtt_conn.site.id)

                # Controlla dispositivi offline (usa il message_processor esistente)
                try:
                    from mqtt.services.message_processor import message_processor
                    message_processor.check_offline_devices()
                except Exception as e:
                    logger.error(f"Error checking offline devices: {e}")

            except Exception as e:
                logger.error(f"Monitor error: {e}")

            # Check ogni 30 secondi
            time.sleep(30)

        logger.info("MQTT Monitor stopped")

    def start(self) -> bool:
        """
        Avvia il servizio MQTT.

        Returns:
            bool: True se avviato con successo
        """
        if self.running:
            logger.warning("MQTT Service already running")
            return True

        logger.info("Starting MQTT Service...")

        self.running = True
        self._should_stop = False

        # Avvia tutte le connessioni abilitate
        self.start_all()

        # Avvia thread di monitoring
        self.monitor_thread = threading.Thread(
            target=self.monitor_connections,
            name="mqtt-service-monitor",
            daemon=True
        )
        self.monitor_thread.start()

        logger.info("MQTT Service started")
        return True

    def stop(self) -> bool:
        """
        Ferma il servizio MQTT.

        Returns:
            bool: True se fermato con successo
        """
        if not self.running:
            logger.warning("MQTT Service not running")
            return True

        logger.info("Stopping MQTT Service...")

        self._should_stop = True
        self.running = False

        start_time = time.time()

        # Disconnetti tutte le connessioni IN PARALLELO
        with self._connections_lock:
            connection_managers = list(self.connections.values())

        if connection_managers:
            logger.info(f"Disconnecting {len(connection_managers)} connections in parallel...")

            # Disconnessioni parallele con threading
            disconnect_threads = []
            for conn_manager in connection_managers:
                thread = threading.Thread(
                    target=conn_manager.disconnect,
                    daemon=True  # Non bloccare shutdown se thread non termina
                )
                thread.start()
                disconnect_threads.append(thread)

            # Aspetta completamento con timeout globale di 5s
            max_wait = 5.0
            for thread in disconnect_threads:
                remaining = max_wait - (time.time() - start_time)
                if remaining > 0:
                    thread.join(timeout=remaining)
                else:
                    logger.warning("Disconnect timeout reached, forcing shutdown")
                    break

            elapsed = time.time() - start_time
            logger.info(f"All connections disconnected in {elapsed:.2f}s")
        else:
            logger.info("No active connections to disconnect")

        # Aspetta che il monitor thread finisca
        if self.monitor_thread and self.monitor_thread.is_alive():
            remaining = 5.0 - (time.time() - start_time)
            if remaining > 0:
                self.monitor_thread.join(timeout=remaining)
            if self.monitor_thread.is_alive():
                logger.warning("Monitor thread did not terminate cleanly")

        total_elapsed = time.time() - start_time
        logger.info(f"MQTT Service stopped (total time: {total_elapsed:.2f}s)")
        return True

    def is_running(self) -> bool:
        """
        Verifica se il servizio è in esecuzione.

        Returns:
            bool: True se in esecuzione
        """
        return self.running

    def publish_message(self, site_id: int, topic: str, message: str, qos: int = 0) -> Dict[str, Any]:
        """
        Pubblica un messaggio MQTT per un sito specifico.

        Args:
            site_id: ID del sito
            topic: Topic MQTT
            message: Messaggio da pubblicare
            qos: Quality of Service (0, 1, 2)

        Returns:
            Dict con success e messaggio
        """
        try:
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            with self._connections_lock:
                manager = self.connections.get(mqtt_conn.id)

                if not manager:
                    return {
                        'success': False,
                        'message': f'No active MQTT connection for site {site_id}'
                    }

                return manager.publish_message(topic, message, qos)

        except MqttConnection.DoesNotExist:
            return {
                'success': False,
                'message': f'No MQTT connection configured for site {site_id}'
            }
        except Exception as e:
            logger.error(f"[Site {site_id}] Error publishing message: {e}")
            return {
                'success': False,
                'message': f'Error publishing message: {str(e)}'
            }


# Singleton instance
mqtt_service = MQTTService()
