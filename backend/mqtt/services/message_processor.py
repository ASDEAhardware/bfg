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
    Gestisce SOLO i seguenti topic:
    1. [sito]/gateway/[n]/status -> Info generiche Gateway (salva raw data)
    2. [sito]/gateway/[n]/datalogger/all/status -> Dati aggregati Datalogger/Sensori
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
            try:
                if isinstance(payload, bytes):
                    payload_str = payload.decode('utf-8')
                else:
                    payload_str = payload
                payload_data = json.loads(payload_str)
            except (json.JSONDecodeError, UnicodeDecodeError, AttributeError) as e:
                # Log solo errori gravi, ignoriamo payload non-json
                return True 

            # Parse della struttura topic
            topic_info = self._parse_topic_structure(topic)

            # Se il topic non è riconosciuto, ignoralo
            if topic_info['type'] == 'unknown':
                return True

            logger.info(f"Processing topic: {topic} (Type: {topic_info['type']})")

            # Dispatcher
            if topic_info['type'] == 'gateway_status':
                return self._process_gateway_status(site_id, topic, payload_data, topic_info)
            
            elif topic_info['type'] == 'datalogger_status_aggregated':
                return self._process_datalogger_status_aggregated(site_id, topic, payload_data, topic_info)

            return True

        except Exception as e:
            logger.error(f"Error processing MQTT message for site {site_id}, topic {topic}: {e}")
            return False

    def _parse_topic_structure(self, topic: str) -> Dict[str, Any]:
        """
        Parsea la struttura topic accettando SOLO i due formati richiesti.
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

# Singleton instance
message_processor = MqttMessageProcessor()
