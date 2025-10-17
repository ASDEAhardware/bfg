"""
Auto-Discovery Service per MQTT
Gestisce la logica di auto-discovery di Gateway, Datalogger e Sensor dai messaggi MQTT
"""

import json
import logging
from datetime import datetime
from django.utils import timezone
from django.db import transaction, DatabaseError
from django.core.exceptions import ValidationError

from ..models import Gateway, Datalogger, Sensor
from sites.models import Site

logger = logging.getLogger(__name__)

class MqttProcessingError(Exception):
    """Custom exception per errori di processing MQTT"""
    def __init__(self, message, topic=None, payload=None, original_error=None):
        super().__init__(message)
        self.topic = topic
        self.payload = payload
        self.original_error = original_error

class MqttValidationError(MqttProcessingError):
    """Errori di validazione dati MQTT"""
    pass

class MqttDiscoveryError(MqttProcessingError):
    """Errori specifici di auto-discovery"""
    pass


class MqttAutoDiscoveryService:
    """
    Service per auto-discovery di dispositivi da messaggi MQTT

    Pattern Topic Gestiti:
    - sito_001/gateway/heartbeat
    - sito_001/datalogger/monstro/1/heartbeat
    - sito_001/datalogger/adaq/2/heartbeat
    """

    def process_mqtt_message(self, site, topic, payload):
        """
        Router principale per messaggi MQTT

        Args:
            site: Instance del modello Site
            topic: Topic MQTT completo (es: sito_001/datalogger/monstro/1/heartbeat)
            payload: Dict con payload JSON del messaggio
        """
        try:
            parts = topic.split('/')
            if len(parts) < 3:
                logger.warning(f"Topic malformato: {topic}")
                return

            site_code = parts[0]  # sito_001
            device_category = parts[1]  # gateway o datalogger

            # Verifica che il site_code corrisponda
            if site.code != site_code:
                logger.warning(f"Site code mismatch: topic={site_code}, site={site.code}")
                return

            if device_category == 'datalogger' and len(parts) >= 5:
                # sito_001/datalogger/monstro/1/heartbeat
                self._process_datalogger_message(site, parts, payload)

            elif device_category == 'gateway' and len(parts) >= 3:
                # sito_001/gateway/heartbeat
                self._process_gateway_message(site, parts, payload)

            else:
                logger.debug(f"Topic non gestito: {topic}")

        except ValidationError as e:
            raise MqttValidationError(
                f"Validation error per topic {topic}",
                topic=topic,
                payload=payload,
                original_error=e
            )
        except DatabaseError as e:
            logger.error(f"Database error processing MQTT message {topic}: {e}")
            raise MqttProcessingError(
                f"Database error per topic {topic}",
                topic=topic,
                payload=payload,
                original_error=e
            )
        except Exception as e:
            logger.error(f"Errore generico processing MQTT message {topic}: {e}")
            raise MqttProcessingError(
                f"Errore processing MQTT message {topic}",
                topic=topic,
                payload=payload,
                original_error=e
            )

    def _process_datalogger_message(self, site, topic_parts, payload):
        """
        Gestisce messaggi datalogger con auto-discovery

        Topic: sito_001/datalogger/monstro/1/heartbeat
        Parts: [sito_001, datalogger, monstro, 1, heartbeat]
        """
        datalogger_type = topic_parts[2]  # monstro, adaq
        instance_number = int(topic_parts[3])  # 1, 2, 3
        message_type = topic_parts[4]  # input, output, heartbeat

        if message_type == 'heartbeat':
            # Auto-discovery datalogger dal payload
            datalogger = self._auto_discover_datalogger(
                site, datalogger_type, instance_number, payload
            )

            # Process sensors dal payload se presenti
            sensors_data = payload.get('sensors_last_data', [])
            for sensor_data in sensors_data:
                self._auto_discover_sensor(datalogger, sensor_data)

        else:
            logger.debug(f"Message type {message_type} non gestito per datalogger")

    def _process_gateway_message(self, site, topic_parts, payload):
        """
        Gestisce messaggi gateway con auto-discovery

        Topic: sito_001/gateway/heartbeat
        Parts: [sito_001, gateway, heartbeat]
        """
        if len(topic_parts) >= 3:
            message_type = topic_parts[2]  # heartbeat, input, output

            if message_type == 'heartbeat':
                self._auto_discover_gateway(site, payload)
            else:
                logger.debug(f"Message type {message_type} non gestito per gateway")

    @transaction.atomic
    def _auto_discover_datalogger(self, site, datalogger_type, instance_number, payload):
        """
        Auto-create/update datalogger da messaggio MQTT

        Args:
            site: Site instance
            datalogger_type: Tipo datalogger (monstro, adaq)
            instance_number: Numero istanza (1, 2, 3)
            payload: Payload del messaggio heartbeat

        Returns:
            Datalogger instance
        """
        # Estrai serial number dal payload, fallback su pattern predefinito
        serial_number = payload.get('serial_number')
        if not serial_number:
            serial_number = f"{datalogger_type}_{instance_number}"

        # Get or create datalogger con select_for_update per evitare race conditions
        try:
            datalogger = Datalogger.objects.select_for_update(nowait=True).get(
                site=site,
                serial_number=serial_number
            )
            created = False
        except Datalogger.DoesNotExist:
            try:
                datalogger, created = Datalogger.objects.get_or_create(
                    site=site,
                    serial_number=serial_number,
                    defaults={
                        'label': serial_number,  # Default editabile dall'utente
                        'datalogger_type': datalogger_type,
                        'instance_number': instance_number,
                    }
                )
            except ValidationError as e:
                logger.error(f"Validation error creating datalogger {serial_number}: {e}")
                raise MqttValidationError(
                    f"Invalid datalogger data for {serial_number}",
                    original_error=e
                )
        except DatabaseError as e:
            logger.warning(f"Database lock contention for datalogger {serial_number}, retrying without lock")
            # Fallback senza lock se c'è contesa
            datalogger, created = Datalogger.objects.get_or_create(
                site=site,
                serial_number=serial_number,
                defaults={
                    'label': serial_number,
                    'datalogger_type': datalogger_type,
                    'instance_number': instance_number,
                }
            )

        # Update status e metadata sempre
        now = timezone.now()
        datalogger.is_online = True
        datalogger.last_heartbeat = now
        datalogger.last_communication = now
        datalogger.total_heartbeats += 1
        datalogger.raw_metadata = payload

        # Update campi opzionali se presenti
        if 'firmware_version' in payload:
            datalogger.firmware_version = payload['firmware_version']
        if 'ip_address' in payload:
            datalogger.ip_address = payload['ip_address']

        # Reset downtime se era offline
        if datalogger.last_downtime_start:
            datalogger.last_downtime_start = None

        datalogger.save()

        if created:
            logger.info(f"Nuovo datalogger auto-discovered: {datalogger}")
        else:
            logger.debug(f"Datalogger aggiornato: {datalogger}")

        return datalogger

    @transaction.atomic
    def _auto_discover_gateway(self, site, payload):
        """
        Auto-create/update gateway da messaggio MQTT

        Args:
            site: Site instance
            payload: Payload del messaggio heartbeat

        Returns:
            Gateway instance
        """
        # Estrai serial number dal payload
        serial_number = payload.get('serial_number')
        if not serial_number:
            serial_number = f"gateway_{site.code}"

        # Get or create gateway
        gateway, created = Gateway.objects.get_or_create(
            site=site,
            defaults={
                'serial_number': serial_number,
                'label': serial_number,
            }
        )

        # Update status e metadata sempre
        now = timezone.now()
        gateway.is_online = True
        gateway.last_heartbeat = now
        gateway.last_communication = now
        gateway.raw_metadata = payload

        # Update campi opzionali se presenti
        if 'hostname' in payload:
            gateway.hostname = payload['hostname']
        if 'ip_address' in payload:
            gateway.ip_address = payload['ip_address']
        if 'firmware_version' in payload:
            gateway.firmware_version = payload['firmware_version']
        if 'cpu_usage_percent' in payload:
            gateway.cpu_usage_percent = payload['cpu_usage_percent']
        if 'memory_usage_percent' in payload:
            gateway.memory_usage_percent = payload['memory_usage_percent']
        if 'disk_usage_percent' in payload:
            gateway.disk_usage_percent = payload['disk_usage_percent']
        if 'uptime_seconds' in payload:
            gateway.uptime_seconds = payload['uptime_seconds']

        gateway.save()

        if created:
            logger.info(f"Nuovo gateway auto-discovered: {gateway}")
        else:
            logger.debug(f"Gateway aggiornato: {gateway}")

        return gateway

    @transaction.atomic
    def _auto_discover_sensor(self, datalogger, sensor_data):
        """
        Auto-create/update sensor con dati near real-time

        Args:
            datalogger: Datalogger instance
            sensor_data: Dict con dati del sensore dal payload

        Returns:
            Sensor instance o None se device_name mancante
        """
        device_name = sensor_data.get('device_name')
        if not device_name:
            logger.warning("Sensor data senza device_name, skipping")
            return None

        # Get or create sensor
        sensor, created = Sensor.objects.get_or_create(
            datalogger=datalogger,
            serial_number=device_name,
            defaults={
                'label': device_name,  # Default editabile
            }
        )

        # Parse timestamp dal payload con gestione robusta
        timestamp_str = sensor_data.get('ts')
        if timestamp_str:
            try:
                # Gestisci diversi formati timestamp
                if isinstance(timestamp_str, str):
                    if 'T' in timestamp_str and timestamp_str.endswith('Z'):
                        # ISO format: 2025-10-14T13:57:16.288000Z
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    elif 'T' in timestamp_str:
                        # ISO format senza Z: 2025-10-14T13:57:16.288000
                        timestamp = datetime.fromisoformat(timestamp_str)
                    else:
                        # Format: 2025-10-14 13:57:16.288000
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')

                    # Converti a timezone aware
                    if timezone.is_naive(timestamp):
                        timestamp = timezone.make_aware(timestamp)

                    # Validazione: timestamp non può essere nel futuro oltre 1 minuto
                    future_threshold = timezone.now() + timezone.timedelta(minutes=1)
                    if timestamp > future_threshold:
                        logger.warning(f"Timestamp futuro rilevato: {timestamp_str}, usando timestamp corrente")
                        timestamp = timezone.now()

                else:
                    logger.warning(f"Timestamp non è stringa: {type(timestamp_str)}")
                    timestamp = timezone.now()

            except (ValueError, TypeError, OverflowError) as e:
                logger.warning(f"Errore parsing timestamp {timestamp_str}: {e}")
                timestamp = timezone.now()
        else:
            timestamp = timezone.now()

        # Aggiorna dati near real-time (rolling 3)
        sensor.add_new_reading(timestamp, sensor_data)

        # Update statistiche min/max se ci sono valori numerici
        self._update_sensor_stats(sensor, sensor_data)

        # Update metadata sensore
        sensor.total_messages += 1
        sensor.save()

        if created:
            logger.info(f"Nuovo sensore auto-discovered: {sensor}")
        else:
            logger.debug(f"Sensore aggiornato: {sensor}")

        return sensor

    def _update_sensor_stats(self, sensor, sensor_data):
        """
        Aggiorna statistiche min/max del sensore dai dati numerici
        Con validazione per sicurezza

        Args:
            sensor: Sensor instance
            sensor_data: Dict con dati del sensore
        """
        if not isinstance(sensor_data, dict):
            logger.warning(f"sensor_data non è un dict: {type(sensor_data)}")
            return

        # Cerca valori numerici nel payload che iniziano con "last_"
        for key, value in sensor_data.items():
            if not isinstance(key, str):
                continue

            if key.startswith('last_') and isinstance(value, (int, float)):
                # Validazione range ragionevole per evitare valori anomali
                if not (-1e6 <= value <= 1e6):
                    logger.warning(f"Valore fuori range ignorato per {key}: {value}")
                    continue
                sensor.update_min_max_stats(value)

        # Se ci sono accelerometri, usa anche quelli
        for key in ['acc_x', 'acc_y', 'acc_z', 'incli_x', 'incli_y']:
            if key in sensor_data:
                value = sensor_data[key]
                if isinstance(value, (int, float)):
                    # Validazione range specifico per accelerometri (-20g to 20g range)
                    if not (-200 <= value <= 200):
                        logger.warning(f"Valore accelerometro fuori range ignorato per {key}: {value}")
                        continue
                    sensor.update_min_max_stats(value)


# Singleton instance
auto_discovery_service = MqttAutoDiscoveryService()