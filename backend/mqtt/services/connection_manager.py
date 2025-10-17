"""
MQTT Connection Manager
Gestisce multiple connessioni MQTT con retry esponenziale e auto-discovery
"""

import json
import logging
import threading
import time
from functools import partial
from typing import Dict, Optional

import paho.mqtt.client as mqtt
from django.utils import timezone
from django.conf import settings

from ..models import MqttConnection
from sites.models import Site
from .autodiscovery import auto_discovery_service

logger = logging.getLogger(__name__)


class MqttConnectionManager:
    """
    Gestisce multiple connessioni MQTT con retry esponenziale
    Una connessione per ogni sito configurato
    """

    def __init__(self):
        self.connections: Dict[int, mqtt.Client] = {}  # site_id -> mqtt.Client
        self.retry_delays: Dict[int, int] = {}  # site_id -> current_delay
        self.retry_timers: Dict[int, threading.Timer] = {}  # site_id -> Timer
        self._lock = threading.Lock()

    def start_all_connections(self):
        """Avvia connessioni per tutti i siti configurati"""
        active_connections = MqttConnection.objects.filter(is_enabled=True).select_related('site')

        for connection_config in active_connections:
            try:
                self.start_connection(connection_config.site)
            except Exception as e:
                logger.error(f"Errore avvio connessione {connection_config.site}: {e}")

    def start_connection(self, site: Site):
        """
        Avvia connessione MQTT per un sito specifico

        Args:
            site: Site instance con MqttConnection configurata
        """
        try:
            connection_config = site.mqttconnection
        except MqttConnection.DoesNotExist:
            logger.error(f"Nessuna configurazione MQTT per site {site}")
            return

        if not connection_config.is_enabled:
            logger.info(f"Connessione MQTT disabilitata per site {site}")
            return

        with self._lock:
            # Disconnetti connessione esistente se presente
            if site.id in self.connections:
                self.stop_connection(site)

            try:
                # Crea nuovo client MQTT
                client_id = f"{connection_config.client_id_prefix}_bfg_backend"
                client = mqtt.Client(client_id=client_id)

                # Configura autenticazione
                if connection_config.username:
                    client.username_pw_set(
                        connection_config.username,
                        connection_config.password or ""
                    )

                # Configura SSL se abilitato
                if connection_config.ssl_enabled:
                    client.tls_set(ca_certs=connection_config.ca_cert_path)

                # Configura callbacks
                client.on_connect = partial(self._on_connect, site.id)
                client.on_message = partial(self._on_message, site.id)
                client.on_disconnect = partial(self._on_disconnect, site.id)
                client.on_log = partial(self._on_log, site.id)

                # Connetti al broker
                client.connect(
                    connection_config.broker_host,
                    connection_config.broker_port,
                    connection_config.keep_alive_interval
                )

                # Avvia loop in background
                client.loop_start()

                # Salva client in registry
                self.connections[site.id] = client

                # Reset retry delay su connessione riuscita
                self.retry_delays[site.id] = connection_config.retry_delay

                # Update status
                connection_config.status = 'connecting'
                connection_config.save()

                logger.info(f"Connessione MQTT avviata per {site}")

            except Exception as e:
                self._handle_connection_error(site, str(e))

    def stop_connection(self, site: Site):
        """Stoppa connessione MQTT per un sito"""
        with self._lock:
            if site.id in self.connections:
                client = self.connections[site.id]
                client.loop_stop()
                client.disconnect()
                del self.connections[site.id]

            # Cancella retry timer se presente
            if site.id in self.retry_timers:
                self.retry_timers[site.id].cancel()
                del self.retry_timers[site.id]

            logger.info(f"Connessione MQTT fermata per {site}")

    def stop_all_connections(self):
        """Ferma tutte le connessioni MQTT"""
        sites_to_stop = list(self.connections.keys())
        for site_id in sites_to_stop:
            try:
                site = Site.objects.get(id=site_id)
                self.stop_connection(site)
            except Site.DoesNotExist:
                logger.warning(f"Site {site_id} non trovato durante stop")

    def restart_connection(self, site: Site):
        """Riavvia connessione per un sito"""
        logger.info(f"Riavvio connessione MQTT per {site}")
        self.stop_connection(site)
        time.sleep(1)  # Breve pausa prima del riavvio
        self.start_connection(site)

    def get_connection_status(self, site: Site) -> Dict:
        """Ritorna status della connessione per un sito"""
        is_connected = site.id in self.connections

        try:
            config = site.mqttconnection
            return {
                'is_connected': is_connected,
                'status': config.status,
                'last_connected_at': config.last_connected_at,
                'last_heartbeat_at': config.last_heartbeat_at,
                'connection_errors': config.connection_errors,
                'error_message': config.error_message,
            }
        except MqttConnection.DoesNotExist:
            return {
                'is_connected': False,
                'status': 'no_config',
                'error_message': 'Nessuna configurazione MQTT'
            }

    def _on_connect(self, site_id: int, client, userdata, flags, rc):
        """Callback connessione riuscita"""
        try:
            site = Site.objects.get(id=site_id)
            connection_config = site.mqttconnection

            if rc == 0:
                logger.info(f"MQTT connesso per {site}")

                # Subscribe ai topic configurati
                for topic_config in connection_config.topics.filter(is_active=True):
                    full_topic = topic_config.get_full_topic()
                    client.subscribe(full_topic, qos=topic_config.qos_level)
                    logger.debug(f"Subscribed to {full_topic}")

                # Subscribe al topic generico del sito per auto-discovery
                site_topic = f"{connection_config.client_id_prefix}/#"
                client.subscribe(site_topic, qos=0)
                logger.debug(f"Subscribed to auto-discovery topic: {site_topic}")

                # Update status
                connection_config.status = 'connected'
                connection_config.last_connected_at = timezone.now()
                connection_config.connection_errors = 0  # Reset error count
                connection_config.error_message = ""
                connection_config.save()

            else:
                error_msg = f"Connessione fallita con codice {rc}"
                logger.error(f"MQTT {site}: {error_msg}")
                self._handle_connection_error(site, error_msg)

        except Exception as e:
            logger.error(f"Errore in _on_connect per site {site_id}: {e}")

    def _on_message(self, site_id: int, client, userdata, msg):
        """Callback ricezione messaggio"""
        try:
            site = Site.objects.get(id=site_id)
            topic = msg.topic

            # Decodifica payload
            try:
                payload = json.loads(msg.payload.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning(f"Errore decodifica messaggio da {topic}: {e}")
                return

            logger.debug(f"Messaggio ricevuto da {site}: {topic}")

            # Update last heartbeat timestamp
            site.mqttconnection.last_heartbeat_at = timezone.now()
            site.mqttconnection.save(update_fields=['last_heartbeat_at'])

            # Process tramite auto-discovery service
            auto_discovery_service.process_mqtt_message(site, topic, payload)

        except Site.DoesNotExist:
            logger.error(f"Site {site_id} non trovato durante message processing")
        except Exception as e:
            logger.error(f"Errore processing messaggio per site {site_id}: {e}")

    def _on_disconnect(self, site_id: int, client, userdata, rc):
        """Callback disconnessione"""
        try:
            site = Site.objects.get(id=site_id)

            if rc != 0:
                logger.warning(f"MQTT disconnesso inaspettatamente per {site}: {rc}")
                self._handle_connection_error(site, f"Disconnessione inaspettata: {rc}")
            else:
                logger.info(f"MQTT disconnesso per {site}")
                site.mqttconnection.status = 'disconnected'
                site.mqttconnection.save()

        except Exception as e:
            logger.error(f"Errore in _on_disconnect per site {site_id}: {e}")

    def _on_log(self, site_id: int, client, userdata, level, buf):
        """Callback logging MQTT"""
        if level == mqtt.MQTT_LOG_ERR:
            logger.error(f"MQTT site {site_id}: {buf}")
        elif level == mqtt.MQTT_LOG_WARNING:
            logger.warning(f"MQTT site {site_id}: {buf}")
        else:
            logger.debug(f"MQTT site {site_id}: {buf}")

    def _handle_connection_error(self, site: Site, error_msg: str):
        """
        Gestisce errori con retry esponenziale

        Args:
            site: Site con errore
            error_msg: Messaggio di errore
        """
        try:
            connection_config = site.mqttconnection
            connection_config.status = 'error'
            connection_config.error_message = error_msg
            connection_config.connection_errors += 1
            connection_config.save()

            logger.error(f"Errore connessione {site}: {error_msg}")

            # Calcola delay prossimo retry (esponenziale)
            current_delay = self.retry_delays.get(site.id, connection_config.retry_delay)
            next_delay = min(current_delay * 2, connection_config.max_retry_delay)
            self.retry_delays[site.id] = next_delay

            # Non superare il numero massimo di tentativi
            if connection_config.connection_errors < connection_config.retry_attempts:
                # Schedule retry
                timer = threading.Timer(next_delay, self._retry_connection, args=[site])
                self.retry_timers[site.id] = timer
                timer.start()

                logger.info(f"Retry connessione {site} in {next_delay}s (tentativo {connection_config.connection_errors})")
            else:
                logger.error(f"Massimo numero di retry raggiunto per {site}")
                connection_config.status = 'disabled'
                connection_config.save()

        except Exception as e:
            logger.error(f"Errore in _handle_connection_error per {site}: {e}")

    def _retry_connection(self, site: Site):
        """Esegue retry di connessione"""
        logger.info(f"Tentativo riconnessione per {site}")
        self.start_connection(site)

    def publish_message(self, site: Site, topic_suffix: str, payload: dict, qos: int = 0) -> bool:
        """
        Pubblica messaggio MQTT per un sito

        Args:
            site: Site destination
            topic_suffix: Suffisso topic (es: 'datalogger/monstro/1/control')
            payload: Dict da serializzare come JSON
            qos: Quality of Service

        Returns:
            True se pubblicato con successo
        """
        try:
            if site.id not in self.connections:
                logger.error(f"Nessuna connessione attiva per {site}")
                return False

            client = self.connections[site.id]
            connection_config = site.mqttconnection

            full_topic = f"{connection_config.client_id_prefix}/{topic_suffix}"
            json_payload = json.dumps(payload)

            result = client.publish(full_topic, json_payload, qos=qos)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.debug(f"Messaggio pubblicato su {full_topic}")
                return True
            else:
                logger.error(f"Errore pubblicazione su {full_topic}: {result.rc}")
                return False

        except Exception as e:
            logger.error(f"Errore publish_message per {site}: {e}")
            return False


# Singleton instance
mqtt_connection_manager = MqttConnectionManager()