"""
MQTT Message Processor - Gestisce i messaggi MQTT ricevuti
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db import transaction, models

from ..models import MqttConnection, DiscoveredTopic, Gateway, Datalogger, Sensor
from .mqtt_versioning import versioned_processor
# dynamic_offline_monitor removed - offline checking now done in mqtt_service.py

logger = logging.getLogger(__name__)


class MqttMessageProcessor:
    """
    Processore per messaggi MQTT ricevuti.
    Gestisce auto-discovery e aggiornamento dei modelli Datalogger e Sensor.
    """

    def __init__(self):
        # Configurazione timeout per considerare dispositivi offline (legacy)
        self.DATALOGGER_TIMEOUT_SECONDS = 15  # 3x heartbeat interval (5 sec)
        self.SENSOR_TIMEOUT_SECONDS = 15      # Stesso timeout per sensori

        # Dynamic monitoring now handled by mqtt_service.py monitor thread
        # No need to start separate monitor here

    def process_message(self, site_id: int, topic: str, payload: bytes, qos: int, retain: bool) -> bool:
        """
        Processa un messaggio MQTT ricevuto.

        Args:
            site_id: ID del sito
            topic: Topic MQTT completo
            payload: Payload del messaggio
            qos: Quality of Service
            retain: Flag retain

        Returns:
            bool: True se messaggio processato con successo
        """
        try:
            # Log del messaggio ricevuto
            logger.debug(f"Processing MQTT message: site_id={site_id}, topic={topic}, size={len(payload)}")

            # Decodifica payload JSON
            payload_data = None
            try:
                # Gestisci sia bytes che str
                if isinstance(payload, bytes):
                    payload_str = payload.decode('utf-8')
                else:
                    payload_str = payload
                payload_data = json.loads(payload_str)
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError) as e:
                logger.warning(f"Failed to decode MQTT payload for topic {topic}: {e}")
                # Anche i payload non-JSON vanno loggati nel discovery
                payload_data = {'error': 'invalid_json', 'raw_size': len(payload)}

            # DISCOVERY: Logga SEMPRE il topic ricevuto
            self._log_discovered_topic(site_id, topic, payload_data, len(payload))

            # Se il payload non è JSON valido, non possiamo processarlo ulteriormente
            if payload_data is None or 'error' in payload_data:
                return True  # Discovery completato, ma nessun processing

            # NUOVO: Use versioned processor per gestire processing
            processed = versioned_processor.process_message(topic, payload_data, site_id)

            if processed:
                # Mark topic as processed
                topic_info = self._parse_topic_structure(topic)
                if topic_info['type'] in ['gateway_heartbeat', 'datalogger_heartbeat']:
                    self._mark_topic_as_processed(site_id, topic, topic_info['type'])

            return True  # Il discovery è sempre un successo

        except Exception as e:
            logger.error(f"Error processing MQTT message for site {site_id}, topic {topic}: {e}")
            return False

    def _process_versioned_message(self, site_id: int, topic: str, payload_data: dict, version_info: dict) -> bool:
        """
        Process message con version awareness e dynamic monitoring integration
        Chiamato dal versioned_processor
        """
        try:
            # Estrai informazioni versioning
            api_version = version_info.get('mqtt_api_version', 'v1.0.0')
            message_interval = version_info.get('message_interval_seconds', 60)
            timestamp_str = version_info.get('timestamp')

            # Parse timestamp
            timestamp = self._parse_mqtt_timestamp(timestamp_str) if timestamp_str else timezone.now()

            # Identifica tipo di messaggio dal topic
            topic_info = self._parse_topic_structure(topic)

            processed = False
            device_id = None
            device_type = None

            if topic_info['type'] == 'gateway_heartbeat':
                processed = self._process_new_gateway_heartbeat(site_id, topic, payload_data, topic_info)
                device_id = payload_data.get('system', {}).get('serial_number')
                device_type = 'gateway'

            elif topic_info['type'] == 'datalogger_heartbeat':
                processed = self._process_new_datalogger_heartbeat(site_id, topic, payload_data, topic_info)
                device_id = payload_data.get('serial_number')
                device_type = 'datalogger'

            # Dynamic monitoring now handled by mqtt_service.py monitor thread
            # No need to register heartbeats separately

            # Update API version nel database if processed
            if processed and device_id and device_type:
                self._update_device_api_version(device_id, device_type, api_version)

            return processed

        except Exception as e:
            logger.error(f"Error in versioned message processing: {e}")
            return False

    def _parse_mqtt_timestamp(self, timestamp_str: str) -> datetime:
        """Parse MQTT timestamp in ISO format"""
        try:
            # Parse ISO format: "2025-10-23T08:54:47.534661Z"
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            from datetime import timezone as dt_timezone
            return datetime.fromisoformat(timestamp_str).replace(tzinfo=dt_timezone.utc)
        except Exception as e:
            logger.warning(f"Error parsing timestamp {timestamp_str}: {e}")
            return timezone.now()

    def _update_device_api_version(self, device_id: str, device_type: str, api_version: str):
        """Aggiorna versione API nel database per il device"""
        try:
            with transaction.atomic():
                if device_type == 'gateway':
                    Gateway.objects.filter(serial_number=device_id).update(mqtt_api_version=api_version)
                elif device_type == 'datalogger':
                    Datalogger.objects.filter(serial_number=device_id).update(mqtt_api_version=api_version)
                elif device_type == 'sensor':
                    Sensor.objects.filter(serial_number=device_id).update(mqtt_api_version=api_version)

        except Exception as e:
            logger.error(f"Error updating API version for {device_type} {device_id}: {e}")

    def _is_datalogger_heartbeat(self, topic: str, data: Dict[str, Any]) -> bool:
        """
        Verifica se il messaggio è un heartbeat di datalogger.

        Args:
            topic: Topic MQTT
            data: Dati decodificati

        Returns:
            bool: True se è un heartbeat di datalogger
        """
        # Verifica presenza di sensors_last_data (formato reale datalogger)
        # o heart_beat e sensors_last_data (formato legacy)
        if not isinstance(data, dict):
            return False

        # Nuovo formato reale: solo serial_number + sensors_last_data
        if 'serial_number' in data and 'sensors_last_data' in data and isinstance(data['sensors_last_data'], list):
            return True

        # Formato legacy: heart_beat + sensors_last_data
        if 'heart_beat' in data and 'sensors_last_data' in data and isinstance(data['sensors_last_data'], list):
            return True

        return False

    def _process_datalogger_heartbeat(self, site_id: int, topic: str, data: Dict[str, Any]) -> bool:
        """
        Processa heartbeat di un datalogger.

        Args:
            site_id: ID del sito
            topic: Topic MQTT
            data: Dati heartbeat

        Returns:
            bool: True se processato con successo
        """
        try:
            # Estrai informazioni dal payload
            heart_beat_prefix = data.get('heart_beat', '')
            sensors_data = data.get('sensors_last_data', [])

            logger.info(f"Processing datalogger heartbeat: site_id={site_id}, prefix={heart_beat_prefix}, sensors={len(sensors_data)}")

            # Estrai datalogger ID dal topic (assumendo formato: prefix/datalogger_X/heartbeat)
            datalogger_id = self._extract_datalogger_id_from_topic(topic)
            if not datalogger_id:
                logger.warning(f"Cannot extract datalogger ID from topic: {topic}")
                return False

            # Processa datalogger principale
            datalogger = self._process_datalogger_info(site_id, datalogger_id, heart_beat_prefix, data)
            if not datalogger:
                return False

            # Processa ogni sensore nell'heartbeat
            processed_sensors = 0
            for sensor_data in sensors_data:
                if self._process_sensor_data(datalogger, sensor_data):
                    processed_sensors += 1

            logger.info(f"Heartbeat processed: datalogger={datalogger.serial_number}, sensors={processed_sensors}/{len(sensors_data)}")

            # Aggiorna timestamp ultima comunicazione datalogger
            self._update_datalogger_last_seen(datalogger)

            return True

        except Exception as e:
            logger.error(f"Error processing datalogger heartbeat: {e}")
            return False

    def _extract_datalogger_id_from_topic(self, topic: str) -> Optional[str]:
        """
        Estrae l'ID del datalogger dal topic MQTT.

        Args:
            topic: Topic MQTT (es: "sito_001/datalogger_1/heartbeat")

        Returns:
            str: ID del datalogger o None se non trovato
        """
        try:
            # Split topic e cerca pattern datalogger_X
            parts = topic.split('/')
            for part in parts:
                if part.startswith('datalogger_'):
                    return part

            # Fallback: usa l'ultimo segmento prima di heartbeat
            if len(parts) >= 2 and parts[-1] == 'heartbeat':
                return parts[-2]

            return None

        except Exception as e:
            logger.error(f"Error extracting datalogger ID from topic {topic}: {e}")
            return None

    def _process_datalogger_info(self, site_id: int, datalogger_id: str, heart_beat_prefix: str, data: Dict[str, Any]) -> Optional[Datalogger]:
        """
        Processa informazioni del datalogger e crea/aggiorna record.

        Args:
            site_id: ID del sito
            datalogger_id: ID del datalogger (es: "datalogger_1")
            heart_beat_prefix: Prefisso dal payload
            data: Dati completi heartbeat

        Returns:
            Datalogger: Istanza datalogger creata/aggiornata o None se errore
        """
        try:
            with transaction.atomic():
                # Cerca datalogger esistente per site + datalogger_id come serial_number
                datalogger, created = Datalogger.objects.get_or_create(
                    site_id=site_id,
                    serial_number=datalogger_id,
                    defaults={
                        'label': datalogger_id,  # Default label = serial_number
                        'datalogger_type': 'monstro',  # Tipo inferito dal formato dati
                        'device_id': datalogger_id.replace('datalogger_', ''),
                        'is_online': True,
                        'last_seen_at': timezone.now(),
                        'raw_metadata': data,
                        'total_heartbeats': 1,
                        'missed_heartbeats': 0,
                        'uptime_percentage': 100.0
                    }
                )

                if not created:
                    # Aggiorna datalogger esistente
                    datalogger.is_online = True
                    datalogger.last_seen_at = timezone.now()
                    datalogger.raw_metadata = data
                    datalogger.total_heartbeats += 1

                    # Aggiorna device_id se non presente
                    if not datalogger.device_id:
                        datalogger.device_id = datalogger_id.replace('datalogger_', '')

                    # Aggiorna tipo se non presente
                    if not datalogger.datalogger_type:
                        datalogger.datalogger_type = 'monstro'

                    # Ricalcola uptime percentage
                    if datalogger.total_heartbeats > 0:
                        datalogger.uptime_percentage = (
                            (datalogger.total_heartbeats - datalogger.missed_heartbeats) /
                            datalogger.total_heartbeats
                        ) * 100.0

                    datalogger.save()

                    logger.debug(f"Updated datalogger {datalogger.serial_number}: heartbeats={datalogger.total_heartbeats}")
                else:
                    logger.info(f"Created new datalogger: {datalogger.serial_number} for site {site_id}")

                return datalogger

        except Exception as e:
            logger.error(f"Error processing datalogger info for {datalogger_id}: {e}")
            return None

    def _process_sensor_data(self, datalogger: Datalogger, sensor_data: Dict[str, Any]) -> bool:
        """
        Processa dati di un singolo sensore.

        Args:
            datalogger: Istanza datalogger parent
            sensor_data: Dati del sensore

        Returns:
            bool: True se processato con successo
        """
        try:
            # Estrai serial number del sensore
            serial_number = sensor_data.get('serial_number')
            if not serial_number:
                logger.warning("Sensor data missing serial_number - skipping")
                return False

            # Estrai timestamp
            timestamp_str = sensor_data.get('ts')
            if not timestamp_str:
                logger.warning(f"Sensor {serial_number} missing timestamp - using current time")
                timestamp = timezone.now()
            else:
                try:
                    # Parse timestamp formato "2025-10-20 10:47:39.874000"
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                    timestamp = timezone.make_aware(timestamp)
                except ValueError:
                    logger.warning(f"Invalid timestamp format for sensor {serial_number}: {timestamp_str}")
                    timestamp = timezone.now()

            with transaction.atomic():
                # Cerca sensore esistente
                sensor, created = Sensor.objects.get_or_create(
                    datalogger=datalogger,
                    serial_number=serial_number,
                    defaults={
                        'label': serial_number,
                        'sensor_type': self._infer_sensor_type(sensor_data),
                        'unit_of_measure': self._infer_unit_of_measure(sensor_data),
                        'is_online': True,
                        'last_reading': timestamp,
                        'first_seen_at': timestamp,
                        'last_seen_at': timestamp,
                        'total_messages': 1,
                        'total_readings': 0,  # Sarà incrementato da add_new_reading()
                        'uptime_percentage': 100.0,
                        'consecutive_misses': 0
                    }
                )

                # Aggiorna dati del sensore (nuovo o esistente)
                sensor.is_online = True
                sensor.last_reading = timestamp
                sensor.last_seen_at = timestamp
                sensor.consecutive_misses = 0  # Reset miss counter

                # Aggiorna ultimi 3 dati usando il metodo del modello (che incrementa total_readings)
                sensor.add_new_reading(timestamp, sensor_data)

                if not created:
                    sensor.total_messages += 1

                # Aggiorna statistiche min/max se presente valore numerico principale
                main_value = self._extract_main_sensor_value(sensor_data)
                if main_value is not None:
                    sensor.update_min_max_stats(main_value)

                sensor.save()

                logger.debug(f"Processed sensor {serial_number}: readings={sensor.total_readings}")
                return True

        except Exception as e:
            logger.error(f"Error processing sensor data for {sensor_data.get('serial_number', 'unknown')}: {e}")
            return False

    def _infer_sensor_type(self, sensor_data: Dict[str, Any]) -> str:
        """
        Inferisce il tipo di sensore dai dati.

        Args:
            sensor_data: Dati del sensore

        Returns:
            str: Tipo di sensore inferito
        """
        # Cerca pattern nei nomi dei campi per inferire tipo
        fields = sensor_data.keys()

        if any(field.startswith('acc') for field in fields):
            return 'accelerometer'
        elif any(field.startswith('gyro') for field in fields):
            return 'gyroscope'
        elif any(field.startswith('mag') for field in fields):
            return 'magnetometer'
        elif any(field.startswith('incli') for field in fields):
            return 'inclinometer'
        elif any(field in ['temperature', 'temp'] for field in fields):
            return 'temperature'
        elif any(field in ['humidity', 'hum'] for field in fields):
            return 'humidity'
        elif any(field in ['pressure', 'press'] for field in fields):
            return 'pressure'
        else:
            return 'other'

    def _infer_unit_of_measure(self, sensor_data: Dict[str, Any]) -> str:
        """
        Inferisce l'unità di misura dai dati del sensore.

        Args:
            sensor_data: Dati del sensore

        Returns:
            str: Unità di misura inferita
        """
        sensor_type = self._infer_sensor_type(sensor_data)

        unit_map = {
            'accelerometer': 'g',  # Dati RAW - conversioni solo nel frontend
            'gyroscope': '°/s',
            'magnetometer': 'µT',
            'inclinometer': '°',
            'temperature': '°C',
            'humidity': '%',
            'pressure': 'Pa'
        }

        return unit_map.get(sensor_type, '')

    def _extract_main_sensor_value(self, sensor_data: Dict[str, Any]) -> Optional[float]:
        """
        Estrae il valore principale del sensore per statistiche min/max.

        Args:
            sensor_data: Dati del sensore

        Returns:
            float: Valore principale o None se non trovato
        """
        # Per accelerometri, usa il primo valore acc00
        if 'acc00' in sensor_data:
            try:
                return float(sensor_data['acc00'])
            except (ValueError, TypeError):
                pass

        # Per inclinometri, usa incli_x
        if 'incli_x' in sensor_data:
            try:
                return float(sensor_data['incli_x'])
            except (ValueError, TypeError):
                pass

        # Cerca altri campi numerici comuni
        for field in ['temperature', 'temp', 'humidity', 'pressure', 'value']:
            if field in sensor_data:
                try:
                    return float(sensor_data[field])
                except (ValueError, TypeError):
                    continue

        return None

    def _update_datalogger_last_seen(self, datalogger: Datalogger):
        """
        Aggiorna timestamp ultima comunicazione del datalogger.
        NOTA: Il dynamic monitoring ora gestisce automaticamente gli stati,
        questo metodo mantiene compatibilità per il tracking base.

        Args:
            datalogger: Istanza datalogger
        """
        try:
            datalogger.last_seen_at = timezone.now()
            datalogger.save(update_fields=['last_seen_at'])
        except Exception as e:
            logger.error(f"Error updating datalogger last_seen for {datalogger.serial_number}: {e}")

    def check_offline_devices(self):
        """
        Controlla e marca come offline i dispositivi che non inviano heartbeat da troppo tempo.
        Questo metodo viene chiamato periodicamente dal monitoring thread.
        """
        try:
            current_time = timezone.now()
            timeout_threshold = current_time - timedelta(seconds=self.DATALOGGER_TIMEOUT_SECONDS)

            # Trova datalogger che dovrebbero essere offline
            offline_dataloggers = Datalogger.objects.filter(
                is_online=True,
                last_seen_at__lt=timeout_threshold
            )

            offline_count = 0
            for datalogger in offline_dataloggers:
                logger.info(f"Marking datalogger {datalogger.serial_number} as offline (last seen: {datalogger.last_seen_at})")

                datalogger.is_online = False
                datalogger.missed_heartbeats += 1
                datalogger.last_downtime_start = current_time

                # Ricalcola uptime percentage
                if datalogger.total_heartbeats > 0:
                    datalogger.uptime_percentage = (
                        (datalogger.total_heartbeats - datalogger.missed_heartbeats) /
                        datalogger.total_heartbeats
                    ) * 100.0

                datalogger.save()
                offline_count += 1

                # Marca anche i sensori del datalogger come offline
                self._mark_datalogger_sensors_offline(datalogger)

            if offline_count > 0:
                logger.info(f"Marked {offline_count} dataloggers as offline")

            # Controlla sensori individuali per timeout
            self._check_offline_sensors(current_time)

        except Exception as e:
            logger.error(f"Error checking offline devices: {e}")

    def _mark_datalogger_sensors_offline(self, datalogger: Datalogger):
        """
        Marca tutti i sensori di un datalogger come offline.

        Args:
            datalogger: Istanza datalogger
        """
        try:
            current_time = timezone.now()

            offline_sensors = datalogger.sensors.filter(is_online=True)
            for sensor in offline_sensors:
                sensor.is_online = False
                sensor.consecutive_misses += 1
                sensor.save(update_fields=['is_online', 'consecutive_misses'])

            if offline_sensors.exists():
                logger.debug(f"Marked {offline_sensors.count()} sensors offline for datalogger {datalogger.serial_number}")

        except Exception as e:
            logger.error(f"Error marking sensors offline for datalogger {datalogger.serial_number}: {e}")

    def _check_offline_sensors(self, current_time: datetime):
        """
        Controlla sensori individuali per timeout.

        Args:
            current_time: Timestamp corrente
        """
        try:
            timeout_threshold = current_time - timedelta(seconds=self.SENSOR_TIMEOUT_SECONDS)

            offline_sensors = Sensor.objects.filter(
                is_online=True,
                last_seen_at__lt=timeout_threshold
            )

            offline_count = 0
            for sensor in offline_sensors:
                logger.debug(f"Marking sensor {sensor.serial_number} as offline (last seen: {sensor.last_seen_at})")

                sensor.is_online = False
                sensor.consecutive_misses += 1
                sensor.save(update_fields=['is_online', 'consecutive_misses'])
                offline_count += 1

            if offline_count > 0:
                logger.info(f"Marked {offline_count} sensors as offline")

        except Exception as e:
            logger.error(f"Error checking offline sensors: {e}")

    def _is_gateway_heartbeat(self, topic: str, data: Dict[str, Any]) -> bool:
        """
        Verifica se il messaggio è un heartbeat di gateway.

        Args:
            topic: Topic MQTT
            data: Dati decodificati

        Returns:
            bool: True se è un heartbeat di gateway
        """
        # Verifica se il topic termina con /gateway/heartbeat
        return (
            isinstance(data, dict) and
            '/gateway/heartbeat' in topic and
            'system' in data  # Dovrebbe contenere informazioni di sistema
        )

    def _process_gateway_heartbeat(self, site_id: int, topic: str, data: Dict[str, Any]) -> bool:
        """
        Processa un heartbeat di gateway.

        Args:
            site_id: ID del sito
            topic: Topic MQTT completo
            data: Dati del heartbeat

        Returns:
            bool: True se processato con successo
        """
        try:
            # Estrai prefix dal topic (es: "sito_001/gateway/heartbeat" -> "sito_001")
            prefix = topic.split('/gateway/heartbeat')[0].split('/')[-1]
            logger.info(f"Processing gateway heartbeat: site_id={site_id}, prefix={prefix}")

            # Estrai dati di sistema
            system_data = data.get('system', {})
            if not isinstance(system_data, dict):
                logger.warning(f"Invalid system data in gateway heartbeat: {system_data}")
                return False

            timestamp = timezone.now()

            with transaction.atomic():
                # Recupera o crea il sito (dovrebbe già esistere)
                from sites.models import Site
                try:
                    site = Site.objects.get(id=site_id)
                except Site.DoesNotExist:
                    logger.error(f"Site {site_id} not found for gateway heartbeat")
                    return False

                # Usa serial_number dal payload se presente, altrimenti derivalo dal topic
                gateway_serial = system_data.get('serial_number') or f"{prefix}-gateway_1"
                gateway, created = Gateway.objects.get_or_create(
                    serial_number=gateway_serial,
                    defaults={
                        'site': site,
                        'label': gateway_serial,  # Default label = serial_number
                        'hostname': system_data.get('hostname', ''),
                        'ip_address': system_data.get('ip_address'),
                        'firmware_version': system_data.get('firmware_version', ''),
                        'os_version': system_data.get('os_version', ''),
                        'is_online': True,
                        'system_uptime': system_data.get('system_uptime', ''),
                        'cpu_load_percent': system_data.get('cpu_load_percent'),
                        'ram_total_gb': system_data.get('ram_total_gb'),
                        'ram_used_gb': system_data.get('ram_used_gb'),
                        'ram_percent_used': system_data.get('ram_percent_used'),
                        'disk_total_gb': system_data.get('disk_total_gb'),
                        'disk_free_gb': system_data.get('disk_free_gb'),
                        'disk_percent_used': system_data.get('disk_percent_used'),
                        'raw_metadata': system_data,  # Salva tutto il payload per debug
                    }
                )

                # Aggiorna gateway esistente
                if not created:
                    # Aggiorna sempre il sito (nel caso il gateway sia migrato)
                    gateway.site = site
                    gateway.is_online = True

                    # Aggiorna informazioni di sistema
                    gateway.hostname = system_data.get('hostname', gateway.hostname)
                    gateway.ip_address = system_data.get('ip_address') or gateway.ip_address
                    gateway.firmware_version = system_data.get('firmware_version', gateway.firmware_version)
                    gateway.os_version = system_data.get('os_version', gateway.os_version)
                    gateway.system_uptime = system_data.get('system_uptime', gateway.system_uptime)

                    # Aggiorna metriche CPU
                    if 'cpu_load_percent' in system_data:
                        gateway.cpu_load_percent = system_data['cpu_load_percent']

                    # Aggiorna metriche RAM
                    if 'ram_total_gb' in system_data:
                        gateway.ram_total_gb = system_data['ram_total_gb']
                    if 'ram_used_gb' in system_data:
                        gateway.ram_used_gb = system_data['ram_used_gb']
                    if 'ram_percent_used' in system_data:
                        gateway.ram_percent_used = system_data['ram_percent_used']

                    # Aggiorna metriche Disk
                    if 'disk_total_gb' in system_data:
                        gateway.disk_total_gb = system_data['disk_total_gb']
                    if 'disk_free_gb' in system_data:
                        gateway.disk_free_gb = system_data['disk_free_gb']
                    if 'disk_percent_used' in system_data:
                        gateway.disk_percent_used = system_data['disk_percent_used']

                    # Aggiorna raw metadata per debug
                    gateway.raw_metadata = system_data

                    gateway.save()

                # Processa eventuali datalogger dal gateway heartbeat
                dataloggers_data = data.get('dataloggers', [])
                if isinstance(dataloggers_data, list):
                    self._process_dataloggers_from_gateway(gateway, dataloggers_data, timestamp)

                action = "Created" if created else "Updated"
                logger.info(f"{action} gateway: {gateway.label} (Site: {site.name})")
                return True

        except Exception as e:
            logger.error(f"Error processing gateway heartbeat for site {site_id}: {e}")
            return False

    def _process_dataloggers_from_gateway(self, gateway, dataloggers_data: List[Dict], timestamp):
        """
        Processa informazioni sui datalogger dal gateway heartbeat.

        Args:
            gateway: Oggetto Gateway
            dataloggers_data: Lista di dati sui datalogger
            timestamp: Timestamp del messaggio
        """
        try:
            processed_datalogger_serials = set()

            for dl_data in dataloggers_data:
                if not isinstance(dl_data, dict):
                    continue

                dl_serial = dl_data.get('serial_number')
                if not dl_serial:
                    continue

                # Crea o aggiorna Datalogger
                datalogger, created = Datalogger.objects.get_or_create(
                    gateway=gateway,
                    serial_number=dl_serial,
                    defaults={
                        'label': dl_data.get('label', dl_serial),
                        'model': dl_data.get('model', ''),
                        'firmware_version': dl_data.get('firmware_version', ''),
                        'ip_address': dl_data.get('ip_address'),
                        'is_active': dl_data.get('is_active', True),
                        'is_online': True,
                    }
                )

                if not created:
                    # Aggiorna datalogger esistente
                    datalogger.is_online = True
                    datalogger.is_active = dl_data.get('is_active', datalogger.is_active)
                    if 'ip_address' in dl_data:
                        datalogger.ip_address = dl_data['ip_address']
                    if 'firmware_version' in dl_data:
                        datalogger.firmware_version = dl_data['firmware_version']
                    datalogger.save()

                processed_datalogger_serials.add(dl_serial)
                action = "Created" if created else "Updated"
                logger.debug(f"{action} datalogger from gateway: {datalogger.label}")

            # Mark dataloggers not present in gateway message as offline
            self._mark_missing_dataloggers_offline(gateway, processed_datalogger_serials)

        except Exception as e:
            logger.error(f"Error processing dataloggers from gateway: {e}")

    def _log_discovered_topic(self, site_id: int, topic: str, payload_data: Dict[str, Any], payload_size: int):
        """
        Logga un topic scoperto nel database per analisi e discovery.

        Args:
            site_id: ID del sito
            topic: Topic completo ricevuto
            payload_data: Dati decodificati del payload
            payload_size: Dimensione del payload in bytes
        """
        try:
            from sites.models import Site

            # Estrai topic pattern (rimuovi prefix)
            topic_parts = topic.split('/', 1)
            topic_pattern = topic_parts[1] if len(topic_parts) > 1 else topic

            site = Site.objects.get(id=site_id)

            # Crea o aggiorna il topic scoperto
            discovered_topic, created = DiscoveredTopic.objects.get_or_create(
                site=site,
                topic_path=topic,
                defaults={
                    'topic_pattern': topic_pattern,
                    'sample_payload': payload_data,
                    'payload_size_avg': float(payload_size),
                    'message_count': 1,
                }
            )

            if not created:
                # Aggiorna topic esistente
                discovered_topic.message_count += 1

                # Aggiorna dimensione media payload
                if discovered_topic.payload_size_avg:
                    discovered_topic.payload_size_avg = (
                        (discovered_topic.payload_size_avg * (discovered_topic.message_count - 1) + payload_size) /
                        discovered_topic.message_count
                    )
                else:
                    discovered_topic.payload_size_avg = float(payload_size)

                # Aggiorna sample payload con l'ultimo ricevuto
                discovered_topic.sample_payload = payload_data

                # Calcola frequenza messaggi (se abbiamo abbastanza dati)
                if discovered_topic.message_count > 1:
                    time_diff = (timezone.now() - discovered_topic.first_seen_at).total_seconds()
                    discovered_topic.message_frequency_seconds = time_diff / (discovered_topic.message_count - 1)

                discovered_topic.save(update_fields=[
                    'last_seen_at', 'message_count', 'sample_payload',
                    'payload_size_avg', 'message_frequency_seconds'
                ])

            if created:
                logger.info(f"🔍 Discovered new topic: {topic} (site {site.name})")
            else:
                logger.debug(f"Updated topic stats: {topic} ({discovered_topic.message_count} msgs)")

        except Exception as e:
            logger.error(f"Error logging discovered topic {topic}: {e}")

    def _mark_topic_as_processed(self, site_id: int, topic: str, processor_name: str):
        """
        Marca un topic come processato con un processore specifico.

        Args:
            site_id: ID del sito
            topic: Topic completo
            processor_name: Nome del processore
        """
        try:
            from sites.models import Site
            site = Site.objects.get(id=site_id)

            DiscoveredTopic.objects.filter(
                site=site,
                topic_path=topic
            ).update(
                is_processed=True,
                processor_name=processor_name
            )

        except Exception as e:
            logger.error(f"Error marking topic as processed {topic}: {e}")

    def _parse_topic_structure(self, topic: str) -> Dict[str, Any]:
        """
        Parsea la nuova struttura topic.

        Formati supportati:
        - [sito]/gateway/[n]/heartbeat
        - [sito]/gateway/[n]/datalogger/[tipo]/[n]/heartbeat
        - [sito]/gateway/[n]/input
        - [sito]/gateway/[n]/output
        - [sito]/gateway/[n]/datalogger/[tipo]/[n]/input
        - [sito]/gateway/[n]/datalogger/[tipo]/[n]/output

        Returns:
            Dict con informazioni parsate del topic
        """
        try:
            parts = topic.split('/')

            if len(parts) < 4:
                return {'type': 'unknown', 'error': 'Topic too short'}

            site_code = parts[0]

            # Deve iniziare con [sito]/gateway/
            if parts[1] != 'gateway':
                return {'type': 'unknown', 'error': 'Not a gateway topic'}

            gateway_number = parts[2]

            # Caso 1: [sito]/gateway/[n]/heartbeat (o input/output)
            if len(parts) == 4:
                function = parts[3]
                if function == 'heartbeat':
                    return {
                        'type': 'gateway_heartbeat',
                        'site_code': site_code,
                        'gateway_number': gateway_number,
                        'function': function
                    }
                else:
                    return {
                        'type': 'gateway_function',
                        'site_code': site_code,
                        'gateway_number': gateway_number,
                        'function': function
                    }

            # Caso 2: [sito]/gateway/[n]/datalogger/[tipo]/[n]/heartbeat (o input/output)
            elif len(parts) == 7 and parts[3] == 'datalogger':
                datalogger_type = parts[4]
                datalogger_number = parts[5]
                function = parts[6]

                if function == 'heartbeat':
                    return {
                        'type': 'datalogger_heartbeat',
                        'site_code': site_code,
                        'gateway_number': gateway_number,
                        'datalogger_type': datalogger_type,
                        'datalogger_number': datalogger_number,
                        'function': function
                    }
                else:
                    return {
                        'type': 'datalogger_function',
                        'site_code': site_code,
                        'gateway_number': gateway_number,
                        'datalogger_type': datalogger_type,
                        'datalogger_number': datalogger_number,
                        'function': function
                    }

            else:
                return {'type': 'unknown', 'error': f'Unrecognized topic structure: {topic}'}

        except Exception as e:
            logger.error(f"Error parsing topic structure {topic}: {e}")
            return {'type': 'unknown', 'error': str(e)}

    def _process_new_gateway_heartbeat(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
        """
        Processa heartbeat gateway con nuova struttura topic.

        Topic: [sito]/gateway/[n]/heartbeat
        """
        try:
            timestamp = timezone.now()

            # Recupera il sito
            from sites.models import Site
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                logger.error(f"Site {site_id} not found for gateway heartbeat")
                return False

            # Estrai dati di sistema (compatibile con la vecchia struttura)
            system_data = data.get('system', data)  # Se non c'è 'system', usa tutto il payload
            if not isinstance(system_data, dict):
                logger.warning(f"Invalid system data in gateway heartbeat: {system_data}")
                return False

            # Usa serial_number dal payload se presente, altrimenti derivalo dal topic
            serial_number = system_data.get('serial_number')
            if not serial_number:
                serial_number = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"

            logger.info(f"Processing gateway heartbeat: site_id={site_id}, gateway={serial_number}")

            with transaction.atomic():
                # Crea o aggiorna Gateway usando serial_number come chiave
                gateway, created = Gateway.objects.get_or_create(
                    serial_number=serial_number,
                    defaults={
                        'site': site,
                        'label': serial_number,  # Default label = serial_number
                        'hostname': system_data.get('hostname', ''),
                        'ip_address': system_data.get('ip_address'),
                        'firmware_version': system_data.get('firmware_version', ''),
                        'os_version': system_data.get('os_version', ''),
                        'is_online': True,
                        'system_uptime': system_data.get('system_uptime', ''),
                        'cpu_load_percent': system_data.get('cpu_load_percent'),
                        'ram_total_gb': system_data.get('ram_total_gb'),
                        'ram_used_gb': system_data.get('ram_used_gb'),
                        'ram_percent_used': system_data.get('ram_percent_used'),
                        'disk_total_gb': system_data.get('disk_total_gb'),
                        'disk_free_gb': system_data.get('disk_free_gb'),
                        'disk_percent_used': system_data.get('disk_percent_used'),
                        'raw_metadata': data,  # Salva tutto il payload originale
                    }
                )

                # Aggiorna gateway esistente
                if not created:
                    # Aggiorna sempre il sito (nel caso il gateway sia migrato)
                    gateway.site = site
                    gateway.is_online = True

                    # Aggiorna informazioni di sistema
                    gateway.hostname = system_data.get('hostname', gateway.hostname)
                    gateway.ip_address = system_data.get('ip_address') or gateway.ip_address
                    gateway.firmware_version = system_data.get('firmware_version', gateway.firmware_version)
                    gateway.os_version = system_data.get('os_version', gateway.os_version)
                    gateway.system_uptime = system_data.get('system_uptime', gateway.system_uptime)

                    # Aggiorna metriche
                    if 'cpu_load_percent' in system_data:
                        gateway.cpu_load_percent = system_data['cpu_load_percent']
                    if 'ram_total_gb' in system_data:
                        gateway.ram_total_gb = system_data['ram_total_gb']
                    if 'ram_used_gb' in system_data:
                        gateway.ram_used_gb = system_data['ram_used_gb']
                    if 'ram_percent_used' in system_data:
                        gateway.ram_percent_used = system_data['ram_percent_used']
                    if 'disk_total_gb' in system_data:
                        gateway.disk_total_gb = system_data['disk_total_gb']
                    if 'disk_free_gb' in system_data:
                        gateway.disk_free_gb = system_data['disk_free_gb']
                    if 'disk_percent_used' in system_data:
                        gateway.disk_percent_used = system_data['disk_percent_used']

                    # Aggiorna raw metadata
                    gateway.raw_metadata = data

                    gateway.save()

                action = "Created" if created else "Updated"
                logger.info(f"{action} gateway: {gateway.label} (Site: {site.name})")
                return True

        except Exception as e:
            logger.error(f"Error processing new gateway heartbeat for site {site_id}: {e}")
            return False

    def _process_new_datalogger_heartbeat(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
        """
        Processa heartbeat datalogger con nuova struttura topic.
        Topic: [sito]/gateway/[n]/datalogger/[tipo]/[n]/heartbeat

        IMPORTANTE: Il datalogger DEVE essere associato a un gateway esistente.
        Se il gateway non esiste, il record datalogger viene ignorato.
        """
        try:
            timestamp = timezone.now()

            # Recupera il sito
            from sites.models import Site
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                logger.error(f"Site {site_id} not found for datalogger heartbeat")
                return False

            # Trova o crea il gateway parent utilizzando la struttura topic (nuovo formato)
            gateway_serial_number = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"
            try:
                gateway = Gateway.objects.get(serial_number=gateway_serial_number)
            except Gateway.DoesNotExist:
                logger.info(f"Gateway {gateway_serial_number} not found - auto-creating from datalogger heartbeat")
                # Auto-crea il gateway se non esiste
                gateway = Gateway.objects.create(
                    site=site,
                    serial_number=gateway_serial_number,
                    label=f"Gateway {topic_info['gateway_number']}",
                    is_online=True,
                    connection_status='online',
                    mqtt_api_version=version_info.get('mqtt_api_version', '1.0.0'),
                    expected_heartbeat_interval=version_info.get('message_interval_seconds', 60)
                )

            # Genera serial_number datalogger basato sulla nuova struttura
            datalogger_serial = data.get('serial_number')
            if not datalogger_serial:
                datalogger_serial = f"{topic_info['site_code']}_gateway_{topic_info['gateway_number']}_datalogger_{topic_info['datalogger_type']}_{topic_info['datalogger_number']}"

            logger.info(f"Processing datalogger heartbeat: site_id={site_id}, datalogger={datalogger_serial}, gateway={gateway_serial_number}")

            with transaction.atomic():
                # Crea o aggiorna Datalogger usando serial_number come chiave
                datalogger, created = Datalogger.objects.get_or_create(
                    serial_number=datalogger_serial,
                    defaults={
                        'site': site,
                        'gateway': gateway,  # ASSOCIA AL GATEWAY
                        'label': datalogger_serial,  # Default label = serial_number
                        'datalogger_type': topic_info['datalogger_type'],
                        'device_id': topic_info['datalogger_number'],
                        'is_online': True,
                        'last_seen_at': timestamp,
                        'firmware_version': data.get('firmware_version', ''),
                        'ip_address': data.get('ip_address'),
                        'total_heartbeats': 1,
                        'missed_heartbeats': 0,
                        'uptime_percentage': 100.0,
                        'raw_metadata': data,  # Salva tutto il payload originale
                    }
                )

                # Aggiorna datalogger esistente
                if not created:
                    # Verifica che il gateway sia ancora lo stesso
                    if datalogger.gateway_id != gateway.id:
                        logger.warning(f"Datalogger {datalogger_serial} gateway changed from {datalogger.gateway_id} to {gateway.id}")
                        datalogger.gateway = gateway

                    # Aggiorna sempre il sito e gateway
                    datalogger.site = site
                    datalogger.gateway = gateway
                    datalogger.is_online = True
                    datalogger.last_seen_at = timestamp
                    datalogger.total_heartbeats += 1

                    # Aggiorna informazioni opzionali
                    if 'firmware_version' in data:
                        datalogger.firmware_version = data['firmware_version']
                    if 'ip_address' in data:
                        datalogger.ip_address = data['ip_address']

                    # Ricalcola uptime percentage
                    if datalogger.total_heartbeats > 0:
                        datalogger.uptime_percentage = (
                            (datalogger.total_heartbeats - datalogger.missed_heartbeats) /
                            datalogger.total_heartbeats
                        ) * 100.0

                    # Aggiorna raw metadata
                    datalogger.raw_metadata = data

                datalogger.save()

                # Processa dati sensori se presenti (formato reale: sensors_last_data)
                sensors_data = data.get('sensors_last_data', []) or data.get('sensors', [])
                processed_sensor_serials = set()

                if sensors_data and isinstance(sensors_data, list):
                    logger.info(f"Processing {len(sensors_data)} sensors for datalogger {datalogger.serial_number}")
                    for sensor_data in sensors_data:
                        if isinstance(sensor_data, dict):
                            success = self._process_sensor_data(datalogger, sensor_data)
                            if success:
                                sensor_serial = sensor_data.get('serial_number', 'unknown')
                                processed_sensor_serials.add(sensor_serial)
                                logger.debug(f"Processed sensor {sensor_serial}")
                            else:
                                logger.warning(f"Failed to process sensor {sensor_data.get('serial_number', 'unknown')}")
                else:
                    logger.debug(f"No sensor data found in datalogger heartbeat")

                # Mark sensors not present in MQTT message as offline
                self._mark_missing_sensors_offline(datalogger, processed_sensor_serials)

                action = "Created" if created else "Updated"
                logger.info(f"{action} datalogger: {datalogger.label} (Gateway: {gateway.label}, Site: {site.name})")
                return True

        except Exception as e:
            logger.error(f"Error processing new datalogger heartbeat for site {site_id}: {e}")
            return False

    def _mark_missing_sensors_offline(self, datalogger: Datalogger, processed_sensor_serials: set):
        """
        Marca come offline tutti i sensori del datalogger che non sono presenti nel messaggio MQTT.

        Args:
            datalogger: Il datalogger che ha inviato il messaggio
            processed_sensor_serials: Set dei serial number dei sensori presenti nel messaggio MQTT
        """
        try:
            # Trova tutti i sensori di questo datalogger
            all_sensors = Sensor.objects.filter(datalogger=datalogger)

            # Identifica i sensori mancanti dal messaggio MQTT
            missing_sensors = all_sensors.exclude(serial_number__in=processed_sensor_serials)

            if missing_sensors.exists():
                # Aggiorna tutti i sensori mancanti come offline
                updated_count = missing_sensors.update(
                    is_online=False,
                    connection_status='offline',
                    last_status_change=timezone.now(),
                    consecutive_misses=models.F('consecutive_misses') + 1
                )

                logger.info(f"Marked {updated_count} missing sensors as offline for datalogger {datalogger.serial_number}")

                # Log dettagliato dei sensori marcati offline
                for sensor in missing_sensors:
                    logger.debug(f"Sensor {sensor.serial_number} marked offline (missing from MQTT message)")
            else:
                logger.debug(f"All sensors for datalogger {datalogger.serial_number} are present in MQTT message")

        except Exception as e:
            logger.error(f"Error marking missing sensors offline for datalogger {datalogger.serial_number}: {e}")

    def _mark_missing_dataloggers_offline(self, gateway: Gateway, processed_datalogger_serials: set):
        """
        Marca come offline tutti i datalogger del gateway che non sono presenti nel messaggio MQTT.

        Args:
            gateway: Il gateway che ha inviato il messaggio
            processed_datalogger_serials: Set dei serial number dei datalogger presenti nel messaggio MQTT
        """
        try:
            # Trova tutti i datalogger di questo gateway
            all_dataloggers = Datalogger.objects.filter(gateway=gateway)

            # Identifica i datalogger mancanti dal messaggio MQTT
            missing_dataloggers = all_dataloggers.exclude(serial_number__in=processed_datalogger_serials)

            if missing_dataloggers.exists():
                # Aggiorna tutti i datalogger mancanti come offline
                updated_count = missing_dataloggers.update(
                    is_online=False,
                    connection_status='offline',
                    last_status_change=timezone.now(),
                    consecutive_misses=models.F('consecutive_misses') + 1
                )

                logger.info(f"Marked {updated_count} missing dataloggers as offline for gateway {gateway.serial_number}")

                # Cascade offline status to sensors of missing dataloggers
                for datalogger in missing_dataloggers:
                    datalogger.sensors.update(
                        is_online=False,
                        connection_status='datalogger_offline',
                        last_status_change=timezone.now()
                    )
                    logger.debug(f"Datalogger {datalogger.serial_number} marked offline (missing from gateway message)")
            else:
                logger.debug(f"All dataloggers for gateway {gateway.serial_number} are present in MQTT message")

        except Exception as e:
            logger.error(f"Error marking missing dataloggers offline for gateway {gateway.serial_number}: {e}")


# Singleton instance
message_processor = MqttMessageProcessor()