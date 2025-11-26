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
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


class MqttMessageProcessor:
    """
    Processore per messaggi MQTT ricevuti.
    Gestisce i seguenti topic:
    1. [sito]/gateway/[n]/status -> Info generiche Gateway (salva raw data)
    2. [sito]/gateway/[n]/datalogger/all/status -> Dati aggregati Datalogger/Sensori (formato legacy)
    3. [sito]/gateway/[n]/dataloggers/telemetry -> Telemetria completa devices + sensori
    """

    def __init__(self):
        self.channel_layer = get_channel_layer()

    def _broadcast_update(self, site_id: int, event_type: str, data: dict = None):
        """
        Invia aggiornamento via WebSocket
        """
        try:
            if not self.channel_layer:
                return

            message = {
                "type": event_type,
                "site_id": site_id,
                "timestamp": timezone.now().isoformat()
            }
            if data:
                message.update(data)

            async_to_sync(self.channel_layer.group_send)(
                "mqtt_status_updates",
                {
                    "type": "status_update",
                    "message": message
                }
            )
        except Exception as e:
            logger.error(f"Error broadcasting WebSocket update: {e}")

    def process_message(self, site_id: int, topic: str, payload: bytes, qos: int, retain: bool) -> bool:
        """
        Entry point per il processing dei messaggi.
        """
        try:
            # Decodifica payload JSON
            payload_data = None
            try:
                if isinstance(payload, bytes):
                    payload_str = payload.decode('utf-8')
                else:
                    payload_str = payload
                payload_data = json.loads(payload_str)
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError) as e:
                # Log solo errori gravi, ignoriamo payload non-json
                payload_data = None

            # **STEP 1: AUTO-DISCOVERY - Salva TUTTI i topic ricevuti**
            self._save_discovered_topic(site_id, topic, payload_data, payload)

            # **STEP 2: PARSING e PROCESSING - solo per topic riconosciuti**
            # Parse della struttura topic
            topic_info = self._parse_topic_structure(topic)

            # Se il topic non è riconosciuto, log e ignora (ma è già stato salvato in discovered_topic)
            if topic_info['type'] == 'unknown':
                logger.debug(f"Topic discovered but not recognized for processing: {topic}")
                return True

            logger.info(f"Processing topic: {topic} (Type: {topic_info['type']})")

            # Dispatcher
            if topic_info['type'] == 'gateway_status':
                return self._process_gateway_status(site_id, topic, payload_data, topic_info)

            elif topic_info['type'] == 'datalogger_status_aggregated':
                return self._process_datalogger_status_aggregated(site_id, topic, payload_data, topic_info)

            elif topic_info['type'] == 'dataloggers_telemetry':
                return self._process_dataloggers_telemetry(site_id, topic, payload_data, topic_info)

            return True

        except Exception as e:
            logger.error(f"Error processing MQTT message for site {site_id}, topic {topic}: {e}")
            return False

    def _parse_topic_structure(self, topic: str) -> Dict[str, Any]:
        """
        Parsea la struttura topic accettando SOLO i tre formati richiesti.
        """
        try:
            parts = topic.split('/')

            # Controllo lunghezza minima
            if len(parts) < 4:
                return {'type': 'unknown'}

            site_code = parts[0]

            # Deve iniziare con [sito]/gateway/
            if parts[1] != 'gateway':
                return {'type': 'unknown'}

            gateway_number = parts[2]

            # FORMATO 1: [sito]/gateway/[n]/status
            if len(parts) == 4 and parts[3] == 'status':
                return {
                    'type': 'gateway_status',
                    'site_code': site_code,
                    'gateway_number': gateway_number
                }

            # FORMATO 2: [sito]/gateway/[n]/datalogger/all/status
            if len(parts) == 6 and parts[3] == 'datalogger' and parts[4] == 'all' and parts[5] == 'status':
                return {
                    'type': 'datalogger_status_aggregated',
                    'site_code': site_code,
                    'gateway_number': gateway_number
                }

            # FORMATO 3: [sito]/gateway/[n]/dataloggers/telemetry
            if len(parts) == 5 and parts[3] == 'dataloggers' and parts[4] == 'telemetry':
                return {
                    'type': 'dataloggers_telemetry',
                    'site_code': site_code,
                    'gateway_number': gateway_number
                }

            return {'type': 'unknown'}

        except Exception:
            return {'type': 'unknown'}

    def _process_gateway_status(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
        """
        Processa info generiche del Gateway.
        Topic: [sito]/gateway/[n]/status
        Salva il raw data nel modello Gateway.
        """
        try:
            # Recupera il sito
            from sites.models import Site
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                logger.error(f"Site {site_id} not found")
                return False

            # Costruisci serial number del gateway
            # Usa quello nel payload se c'è, altrimenti costruiscilo dal topic
            serial_number = data.get('serial_number')
            if not serial_number:
                serial_number = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"

            with transaction.atomic():
                gateway, created = Gateway.objects.get_or_create(
                    serial_number=serial_number,
                    defaults={
                        'site': site,
                        'label': f"Gateway {topic_info['gateway_number']}",
                        'is_online': True,
                        'raw_metadata': data  # SALVA IL RAW DATA COME RICHIESTO
                    }
                )

                # Aggiorna sempre raw_metadata e status
                gateway.is_online = True
                gateway.raw_metadata = data
                gateway.site = site # Assicura che il sito sia corretto
                
                # Se ci sono campi specifici nel root del json che matchano il modello, aggiornali
                # Es: ip_address, hostname, firmware_version
                if 'ip_address' in data:
                    gateway.ip_address = data['ip_address']
                if 'hostname' in data:
                    gateway.hostname = data['hostname']
                if 'firmware_version' in data:
                    gateway.firmware_version = data['firmware_version']

                gateway.save()

                action = "Created" if created else "Updated"
                logger.info(f"{action} Gateway {serial_number} status (saved raw data)")

                # Broadcast opzionale per aggiornare UI se necessario
                self._broadcast_update(site_id, "gateway_update", {
                    "gateway_id": gateway.id,
                    "serial_number": gateway.serial_number
                })

            return True

        except Exception as e:
            logger.error(f"Error processing gateway status: {e}")
            return False

    def _process_datalogger_status_aggregated(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
        """
        Processa status aggregato di tutti i datalogger.
        Topic: [sito]/gateway/[n]/datalogger/all/status
        """
        try:
            timestamp = timezone.now()
            if 'timestamp' in data:
                timestamp = self._parse_mqtt_timestamp(data['timestamp'])

            from sites.models import Site
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                return False

            # 1. Assicura che il Gateway esista
            gateway_serial = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"
            gateway, _ = Gateway.objects.get_or_create(
                serial_number=gateway_serial,
                defaults={
                    'site': site,
                    'label': f"Gateway {topic_info['gateway_number']}",
                    'is_online': True
                }
            )

            # 2. Processa la lista dei dataloggers
            dataloggers_list = data.get('dataloggers', [])
            if not isinstance(dataloggers_list, list):
                return False

            processed_count = 0

            for dl_data in dataloggers_list:
                if not isinstance(dl_data, dict):
                    continue

                dl_serial = dl_data.get('serial_number')
                if not dl_serial:
                    continue

                status = dl_data.get('status', 'unknown')
                is_online = status in ['running', 'online']

                with transaction.atomic():
                    # Crea/Aggiorna Datalogger
                    datalogger, created = Datalogger.objects.get_or_create(
                        serial_number=dl_serial,
                        defaults={
                            'site': site,
                            'gateway': gateway,
                            'label': dl_serial,
                            'is_online': is_online,
                            'acquisition_status': status,
                            'datalogger_type': 'monstro', # Default
                            'last_seen_at': timestamp
                        }
                    )

                    # Aggiorna campi
                    datalogger.gateway = gateway
                    datalogger.site = site
                    datalogger.is_online = is_online
                    datalogger.acquisition_status = status
                    datalogger.last_seen_at = timestamp
                    datalogger.save()

                    # 3. Processa i sensori del datalogger
                    sensors_raw = dl_data.get('sensors_data', [])
                    processed_sensor_ids = self._process_sensors_list(datalogger, sensors_raw, timestamp)
                    
                    # 4. Gestione MISSING SENSORS (Logica Offline)
                    # Imposta offline tutti i sensori di questo datalogger che NON sono stati processati (non presenti nel payload)
                    if processed_sensor_ids is not None:
                        datalogger.sensors.exclude(id__in=processed_sensor_ids).update(is_online=False)

                    # 5. Broadcast evento specifico per QUESTO datalogger
                    # Questo assicura che useMqttEvents nel frontend invalidi le query ['sensors', dlId]
                    self._broadcast_update(site_id, "datalogger_update", {
                        "datalogger_id": datalogger.id,
                        "serial_number": datalogger.serial_number,
                        "status": "online" if is_online else "offline"
                    })
                    
                    processed_count += 1

            logger.info(f"Processed aggregated status: {processed_count} dataloggers")
            return True

        except Exception as e:
            logger.error(f"Error processing aggregated status: {e}")
            return False

    def _process_dataloggers_telemetry(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
        """
        Processa telemetria completa dei dataloggers con devices e sensori.
        Topic: [sito]/gateway/[n]/dataloggers/telemetry

        Struttura payload:
        {
            "serial_number_gateway": "site_001-gateway_1",
            "timestamp": "2025-11-25T15:32:24.661225Z",
            "dataloggers": [
                {
                    "serial_number_datalogger": "bfg_datalogger_all",
                    "status_datalogger": "running",
                    "devices": [
                        {
                            "type": "monstr-o",
                            "serial_number_device": "MNA000123",
                            "data": [
                                {"type": "accelerometer", "value": [1.342, 3.456, 4.567]},
                                {"type": "inclinometer", "value": [1.342, 3.456, 4.567]}
                            ]
                        }
                    ]
                }
            ]
        }
        """
        try:
            # Parse timestamp
            timestamp = timezone.now()
            if 'timestamp' in data:
                timestamp = self._parse_mqtt_timestamp(data['timestamp'])

            # Recupera il sito
            from sites.models import Site
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                logger.error(f"Site {site_id} not found")
                return False

            # 1. GATEWAY: Crea/Aggiorna Gateway
            gateway_serial = data.get('serial_number_gateway')
            if not gateway_serial:
                logger.error("Missing serial_number_gateway in payload")
                return False

            # Estrai message_interval_seconds per gestione offline/online
            message_interval = data.get('message_interval_seconds', 60)  # Default 60s

            with transaction.atomic():
                gateway, created = Gateway.objects.get_or_create(
                    serial_number=gateway_serial,
                    defaults={
                        'site': site,
                        'label': f"Gateway {topic_info['gateway_number']}",
                        'is_online': True,
                        'expected_heartbeat_interval': message_interval,
                        'last_seen_at': timestamp,
                        'raw_metadata': data  # Salva payload completo come metadata
                    }
                )

                if not created:
                    gateway.is_online = True
                    gateway.site = site
                    gateway.expected_heartbeat_interval = message_interval
                    gateway.last_seen_at = timestamp
                    gateway.raw_metadata = data
                    gateway.save()

                logger.info(f"Gateway {gateway_serial} {'created' if created else 'updated'}")

            # 2. DATALOGGERS: Processa lista dataloggers
            dataloggers_list = data.get('dataloggers', [])
            if not isinstance(dataloggers_list, list):
                logger.error("Invalid dataloggers format (expected list)")
                return False

            processed_dataloggers = 0
            processed_sensors_total = 0

            for dl_data in dataloggers_list:
                if not isinstance(dl_data, dict):
                    continue

                # Processa devices (ogni device diventa un datalogger)
                devices = dl_data.get('devices', [])
                if not isinstance(devices, list):
                    continue

                for device in devices:
                    if not isinstance(device, dict):
                        continue

                    # 3. DATALOGGER: Ogni device diventa un Datalogger
                    device_serial = device.get('serial_number_device')
                    device_type = device.get('type', 'unknown')

                    if not device_serial:
                        logger.warning("Device without serial_number_device, skipping")
                        continue

                    # Normalizza tipo (monstr-o -> monstro)
                    datalogger_type = device_type.replace('-', '').lower()

                    with transaction.atomic():
                        datalogger, dl_created = Datalogger.objects.get_or_create(
                            serial_number=device_serial,
                            defaults={
                                'site': site,
                                'gateway': gateway,
                                'label': device_serial,
                                'datalogger_type': datalogger_type,
                                'is_online': True,
                                'acquisition_status': dl_data.get('status_datalogger', 'running'),
                                'expected_heartbeat_interval': message_interval,
                                'last_seen_at': timestamp
                            }
                        )

                        if not dl_created:
                            datalogger.gateway = gateway
                            datalogger.site = site
                            datalogger.is_online = True
                            datalogger.datalogger_type = datalogger_type
                            datalogger.acquisition_status = dl_data.get('status_datalogger', 'running')
                            datalogger.expected_heartbeat_interval = message_interval
                            datalogger.last_seen_at = timestamp
                            datalogger.save()

                        # 4. SENSORI: Processa data array del device
                        sensor_data_list = device.get('data', [])
                        if isinstance(sensor_data_list, list):
                            processed_sensors = self._process_device_sensors(
                                datalogger, device_serial, sensor_data_list, timestamp
                            )
                            processed_sensors_total += processed_sensors

                        # 5. Broadcast update per questo datalogger
                        self._broadcast_update(site_id, "datalogger_update", {
                            "datalogger_id": datalogger.id,
                            "serial_number": datalogger.serial_number,
                            "status": "online"
                        })

                        processed_dataloggers += 1

            logger.info(
                f"Telemetry processed: {processed_dataloggers} dataloggers, "
                f"{processed_sensors_total} sensors"
            )
            return True

        except Exception as e:
            logger.error(f"Error processing telemetry: {e}", exc_info=True)
            return False

    def _process_device_sensors(
        self,
        datalogger: Datalogger,
        device_serial: str,
        sensor_data_list: List[Dict],
        timestamp: datetime
    ) -> int:
        """
        Processa i sensori di un device creando un Sensor per ogni combinazione device+type.

        Args:
            datalogger: Datalogger parent
            device_serial: Serial number del device (es: "MNA000123")
            sensor_data_list: Lista di dati sensori [{"type": "accelerometer", "value": [x,y,z]}, ...]
            timestamp: Timestamp della lettura

        Returns:
            Numero di sensori processati
        """
        processed_count = 0

        for sensor_data in sensor_data_list:
            if not isinstance(sensor_data, dict):
                continue

            sensor_type = sensor_data.get('type')
            sensor_value = sensor_data.get('value')

            if not sensor_type:
                logger.warning("Sensor data missing 'type' field, skipping")
                continue

            # Crea serial_number univoco: device_serial + "-" + type
            # Es: "MNA000123-accelerometer"
            sensor_serial = f"{device_serial}-{sensor_type}"

            try:
                with transaction.atomic():
                    sensor, created = Sensor.objects.get_or_create(
                        datalogger=datalogger,
                        serial_number=sensor_serial,
                        defaults={
                            'label': sensor_serial,
                            'sensor_type': sensor_type,
                            'is_online': True,
                            'expected_heartbeat_interval': datalogger.expected_heartbeat_interval,
                            'last_reading': timestamp,
                            'first_seen_at': timestamp
                        }
                    )

                    # Prepara dati da salvare
                    # Se value è array, convertiamo in dict con chiavi appropriate
                    reading_data = self._format_sensor_value(sensor_type, sensor_value)

                    # Aggiorna il sensore con la nuova lettura
                    sensor.add_new_reading(timestamp, reading_data)
                    sensor.expected_heartbeat_interval = datalogger.expected_heartbeat_interval
                    sensor.save()

                    processed_count += 1
                    logger.debug(f"Sensor {sensor_serial} updated with value: {reading_data}")

            except Exception as e:
                logger.error(f"Error processing sensor {sensor_serial}: {e}")
                continue

        return processed_count

    def _format_sensor_value(self, sensor_type: str, value: Any) -> Dict[str, Any]:
        """
        Formatta il valore del sensore in un dict appropriato.

        Args:
            sensor_type: Tipo sensore (es: "accelerometer", "inclinometer", "ch1")
            value: Valore raw (può essere array, numero, dict)

        Returns:
            Dict con valore formattato (es: {"x": 1.2, "y": 3.4, "z": 5.6})
        """
        if isinstance(value, dict):
            # Già in formato dict, ritorna così
            return value

        if isinstance(value, list):
            # Array di valori, convertiamo in dict con chiavi appropriate
            if sensor_type in ['accelerometer', 'inclinometer']:
                # Array 3D: [x, y, z] oppure [pitch, roll, yaw]
                if len(value) == 3:
                    if sensor_type == 'accelerometer':
                        return {"x": value[0], "y": value[1], "z": value[2]}
                    elif sensor_type == 'inclinometer':
                        return {"pitch": value[0], "roll": value[1], "yaw": value[2] if len(value) > 2 else None}
                elif len(value) == 2:
                    return {"pitch": value[0], "roll": value[1]}
                else:
                    # Array generico
                    return {"values": value}
            else:
                # Per altri tipi (es: "ch1", "ch2")
                # Se è un singolo valore nell'array, estraiamo
                if len(value) == 1:
                    return {"value": value[0]}
                else:
                    return {"values": value}

        # Valore singolo (numero o stringa)
        return {"value": value}

    def _process_sensors_list(self, datalogger: Datalogger, sensors_list: List[Dict], timestamp: datetime) -> List[int]:
        """
        Processa la lista dei sensori per un datalogger.
        Ritorna la lista degli ID dei sensori processati (Online).
        """
        processed_ids = []
        
        if not sensors_list or not isinstance(sensors_list, list):
            return []

        for s_data in sensors_list:
            if not isinstance(s_data, dict):
                continue

            # Supporta sia serial_number che device_name
            s_serial = s_data.get('serial_number') or s_data.get('device_name')
            if not s_serial:
                continue

            # Inferisci tipo se possibile
            s_type = self._infer_sensor_type(s_data)

            sensor, created = Sensor.objects.get_or_create(
                datalogger=datalogger,
                serial_number=s_serial,
                defaults={
                    'label': s_serial,
                    'sensor_type': s_type,
                    'is_online': True,
                    'last_reading': timestamp,
                    'first_seen_at': timestamp
                }
            )

            sensor.is_online = True
            sensor.last_reading = timestamp
            
            # Salva il valore principale se presente
            sensor.save()
            
            processed_ids.append(sensor.id)
            
            # Qui potremmo chiamare sensor.add_new_reading(timestamp, s_data)
            try:
                sensor.add_new_reading(timestamp, s_data)
            except Exception:
                pass 

        return processed_ids

    def _infer_sensor_type(self, data: Dict) -> str:
        keys = str(data.keys()).lower()
        if 'temp' in keys: return 'temperature'
        if 'hum' in keys: return 'humidity'
        if 'acc' in keys: return 'accelerometer'
        if 'incli' in keys: return 'inclinometer'
        return 'other'

    def _parse_mqtt_timestamp(self, timestamp_str: str) -> datetime:
        try:
            if not timestamp_str: return timezone.now()
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            return datetime.fromisoformat(timestamp_str)
        except:
            return timezone.now()

    def _save_discovered_topic(self, site_id: int, topic: str, payload_data: Optional[Dict], payload_raw: bytes) -> None:
        """
        Salva o aggiorna un topic scoperto nel sistema di discovery.
        Questo permette di tracciare TUTTI i topic ricevuti, anche quelli non ancora gestiti.

        Args:
            site_id: ID del sito
            topic: Topic completo ricevuto (es: 'site_001/sensors/temp1')
            payload_data: Payload parsato come JSON (None se non JSON)
            payload_raw: Payload raw (bytes)
        """
        try:
            from sites.models import Site

            # Recupera il sito
            try:
                site = Site.objects.get(id=site_id)
            except Site.DoesNotExist:
                logger.warning(f"Cannot save discovered topic: Site {site_id} not found")
                return

            # Estrai pattern topic (rimuove il prefix del sito se presente)
            topic_parts = topic.split('/', 1)
            topic_pattern = topic_parts[1] if len(topic_parts) > 1 else topic

            # Calcola dimensione payload
            payload_size = len(payload_raw) if payload_raw else 0

            # Get or create discovered topic
            discovered, created = DiscoveredTopic.objects.get_or_create(
                site=site,
                topic_path=topic,
                defaults={
                    'topic_pattern': topic_pattern,
                    'message_count': 1,
                    'sample_payload': payload_data,
                    'payload_size_avg': float(payload_size),
                    'is_processed': False
                }
            )

            if not created:
                # Aggiorna topic esistente
                discovered.message_count += 1
                discovered.last_seen_at = timezone.now()

                # Aggiorna sample payload se è JSON valido
                if payload_data is not None:
                    discovered.sample_payload = payload_data

                # Aggiorna dimensione media payload
                if discovered.payload_size_avg:
                    # Media mobile: (old_avg * count + new_value) / (count + 1)
                    discovered.payload_size_avg = (
                        (discovered.payload_size_avg * (discovered.message_count - 1) + payload_size)
                        / discovered.message_count
                    )
                else:
                    discovered.payload_size_avg = float(payload_size)

                discovered.save(update_fields=[
                    'message_count', 'last_seen_at', 'sample_payload', 'payload_size_avg'
                ])

                logger.debug(f"Updated discovered topic: {topic} (count: {discovered.message_count})")
            else:
                logger.info(f"New topic discovered: {topic}")

        except Exception as e:
            logger.error(f"Error saving discovered topic {topic}: {e}")

    def check_offline_devices(self) -> Dict[str, int]:
        """
        Controlla tutti i dispositivi (Gateway, Datalogger, Sensor) e marca come offline
        quelli che non inviano heartbeat da più di expected_heartbeat_interval * 2.5.

        Formula timeout: timeout_seconds = expected_heartbeat_interval * 2.5

        Returns:
            Dict con contatori: {
                'gateways_checked': int,
                'gateways_offline': int,
                'dataloggers_checked': int,
                'dataloggers_offline': int,
                'sensors_checked': int,
                'sensors_offline': int
            }
        """
        from django.db.models import F, Q
        from datetime import timedelta

        now = timezone.now()
        stats = {
            'gateways_checked': 0,
            'gateways_offline': 0,
            'dataloggers_checked': 0,
            'dataloggers_offline': 0,
            'sensors_checked': 0,
            'sensors_offline': 0
        }

        try:
            # 1. CHECK GATEWAYS
            # Formula: timeout = expected_heartbeat_interval * 2.5
            gateways = Gateway.objects.filter(
                is_online=True,
                expected_heartbeat_interval__isnull=False,
                last_seen_at__isnull=False
            )

            for gateway in gateways:
                stats['gateways_checked'] += 1

                timeout_seconds = gateway.expected_heartbeat_interval * 2.5
                elapsed = (now - gateway.last_seen_at).total_seconds()

                if elapsed > timeout_seconds:
                    gateway.is_online = False
                    gateway.save(update_fields=['is_online'])
                    stats['gateways_offline'] += 1
                    logger.warning(
                        f"Gateway {gateway.serial_number} marked OFFLINE "
                        f"(elapsed: {elapsed:.1f}s, timeout: {timeout_seconds:.1f}s)"
                    )

                    # Broadcast update via WebSocket
                    self._broadcast_update(gateway.site_id, "gateway_offline", {
                        "gateway_id": gateway.id,
                        "serial_number": gateway.serial_number
                    })

            # 2. CHECK DATALOGGERS
            dataloggers = Datalogger.objects.filter(
                is_online=True,
                expected_heartbeat_interval__isnull=False,
                last_seen_at__isnull=False
            )

            for datalogger in dataloggers:
                stats['dataloggers_checked'] += 1

                timeout_seconds = datalogger.expected_heartbeat_interval * 2.5
                elapsed = (now - datalogger.last_seen_at).total_seconds()

                if elapsed > timeout_seconds:
                    datalogger.is_online = False
                    datalogger.acquisition_status = 'offline'
                    datalogger.save(update_fields=['is_online', 'acquisition_status'])
                    stats['dataloggers_offline'] += 1
                    logger.warning(
                        f"Datalogger {datalogger.serial_number} marked OFFLINE "
                        f"(elapsed: {elapsed:.1f}s, timeout: {timeout_seconds:.1f}s)"
                    )

                    # Broadcast update via WebSocket
                    self._broadcast_update(datalogger.site_id, "datalogger_update", {
                        "datalogger_id": datalogger.id,
                        "serial_number": datalogger.serial_number,
                        "status": "offline"
                    })

            # 3. CHECK SENSORS
            sensors = Sensor.objects.filter(
                is_online=True,
                expected_heartbeat_interval__isnull=False,
                last_seen_at__isnull=False
            )

            for sensor in sensors:
                stats['sensors_checked'] += 1

                timeout_seconds = sensor.expected_heartbeat_interval * 2.5
                elapsed = (now - sensor.last_seen_at).total_seconds()

                if elapsed > timeout_seconds:
                    sensor.is_online = False
                    sensor.save(update_fields=['is_online'])
                    stats['sensors_offline'] += 1
                    logger.debug(
                        f"Sensor {sensor.serial_number} marked OFFLINE "
                        f"(elapsed: {elapsed:.1f}s, timeout: {timeout_seconds:.1f}s)"
                    )

                    # Broadcast update via WebSocket (per il datalogger parent)
                    if sensor.datalogger and sensor.datalogger.site_id:
                        self._broadcast_update(sensor.datalogger.site_id, "sensor_offline", {
                            "sensor_id": sensor.id,
                            "serial_number": sensor.serial_number,
                            "datalogger_id": sensor.datalogger_id
                        })

            # Log summary se ci sono stati cambiamenti
            total_offline = stats['gateways_offline'] + stats['dataloggers_offline'] + stats['sensors_offline']
            if total_offline > 0:
                logger.info(
                    f"Offline check completed: "
                    f"Gateways {stats['gateways_offline']}/{stats['gateways_checked']}, "
                    f"Dataloggers {stats['dataloggers_offline']}/{stats['dataloggers_checked']}, "
                    f"Sensors {stats['sensors_offline']}/{stats['sensors_checked']}"
                )

            return stats

        except Exception as e:
            logger.error(f"Error in check_offline_devices: {e}", exc_info=True)
            return stats


# Singleton instance
message_processor = MqttMessageProcessor()
