import json
import logging
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from ..models import MqttConnection, SensorDevice, SensorData

logger = logging.getLogger(__name__)


class MqttMessageParser:
    """
    Parser per messaggi MQTT da datalogger
    """

    @staticmethod
    def parse_heartbeat(payload: str, site_id: int) -> bool:
        """
        Parse heartbeat message e salva sensor data

        Esempio payload:
        {
            "heart_beat": "sito_001",
            "sensors_last_data": [
                {
                    "device_name": "MNA00542",
                    "ts": "2025-10-14 13:57:16.288000",
                    "last_acc00": 0.001188,
                    "last_acc01": -0.005231,
                    "last_acc02": 1.010827,
                    "last_incli_x": -0.314565,
                    "last_incli_y": -0.14058
                }
            ]
        }
        """
        try:
            data = json.loads(payload)

            with transaction.atomic():
                # Update heartbeat timestamp
                conn = MqttConnection.objects.select_for_update().get(site_id=site_id)
                conn.last_heartbeat_at = timezone.now()
                conn.save(update_fields=['last_heartbeat_at'])

                # Process sensors data
                sensors_data = data.get('sensors_last_data', [])
                processed_devices = []

                for sensor_info in sensors_data:
                    device_name = sensor_info.get('device_name')
                    if not device_name:
                        logger.warning(f"Sensor without device_name in site {site_id}")
                        continue

                    processed_devices.append(device_name)

                    # Get or create sensor device
                    sensor_device, created = SensorDevice.objects.get_or_create(
                        site_id=site_id,
                        device_name=device_name,
                        defaults={
                            'is_active': True,
                            'device_type': 'accelerometer',  # default type
                        }
                    )

                    if created:
                        logger.info(f"Created new sensor device: {device_name} for site {site_id}")

                    # Parse timestamp
                    ts_str = sensor_info.get('ts')
                    if ts_str:
                        try:
                            # Gestisce formato: "2025-10-14 13:57:16.288000"
                            sensor_timestamp = datetime.fromisoformat(ts_str)
                            if sensor_timestamp.tzinfo is None:
                                sensor_timestamp = timezone.make_aware(sensor_timestamp)
                        except ValueError:
                            logger.warning(f"Invalid timestamp format: {ts_str}")
                            sensor_timestamp = timezone.now()
                    else:
                        sensor_timestamp = timezone.now()

                    # Update sensor status
                    sensor_device.last_seen_at = timezone.now()
                    sensor_device.is_online = True
                    sensor_device.consecutive_misses = 0
                    sensor_device.total_messages += 1
                    sensor_device.save(update_fields=[
                        'last_seen_at', 'is_online', 'consecutive_misses', 'total_messages'
                    ])

                    # Save sensor data (with 3-record rolling)
                    MqttMessageParser._save_sensor_data_rolling(
                        sensor_device, sensor_info, sensor_timestamp
                    )

                # Mark missing sensors as potentially offline
                MqttMessageParser._update_missing_sensors(site_id, processed_devices)

            logger.debug(f"Processed heartbeat for site {site_id}: {len(sensors_data)} sensors")
            return True

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in heartbeat for site {site_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error parsing heartbeat for site {site_id}: {e}")
            return False

    @staticmethod
    def parse_sys_info(payload: str, site_id: int) -> bool:
        """
        Parse sys_info message (per future use)
        """
        try:
            data = json.loads(payload)
            logger.debug(f"Received sys_info for site {site_id}: {data}")
            # TODO: Implementare parsing sys_info se necessario
            return True
        except Exception as e:
            logger.error(f"Error parsing sys_info for site {site_id}: {e}")
            return False

    @staticmethod
    def _save_sensor_data_rolling(sensor_device, sensor_info, timestamp):
        """
        Mantiene solo 3 record per sensore (rolling)
        """
        try:
            # Crea nuovo record
            sensor_data = SensorData.objects.create(
                sensor_device=sensor_device,
                timestamp=timestamp,
                raw_data=sensor_info,
                acc_x=sensor_info.get('last_acc00'),
                acc_y=sensor_info.get('last_acc01'),
                acc_z=sensor_info.get('last_acc02'),
                incli_x=sensor_info.get('last_incli_x'),
                incli_y=sensor_info.get('last_incli_y'),
                mag_x=sensor_info.get('last_mag_x'),
                mag_y=sensor_info.get('last_mag_y'),
                mag_z=sensor_info.get('last_mag_z'),
                gyro_x=sensor_info.get('last_gyro_x'),
                gyro_y=sensor_info.get('last_gyro_y'),
                gyro_z=sensor_info.get('last_gyro_z')
            )

            # Mantieni solo gli ultimi 3 record
            old_records = SensorData.objects.filter(
                sensor_device=sensor_device
            ).order_by('-timestamp')[3:]  # Skip primi 3, prendi il resto

            if old_records.exists():
                # Elimina records vecchi
                old_ids = list(old_records.values_list('id', flat=True))
                SensorData.objects.filter(id__in=old_ids).delete()
                logger.debug(f"Deleted {len(old_ids)} old records for sensor {sensor_device.device_name}")

        except Exception as e:
            logger.error(f"Error saving sensor data for {sensor_device.device_name}: {e}")

    @staticmethod
    def _update_missing_sensors(site_id, active_devices):
        """
        Marca come offline i sensori non presenti nel heartbeat
        """
        try:
            missing_sensors = SensorDevice.objects.filter(
                site_id=site_id,
                is_online=True
            ).exclude(device_name__in=active_devices)

            for sensor in missing_sensors:
                sensor.consecutive_misses += 1

                # Offline dopo 3 heartbeat mancanti consecutivi
                if sensor.consecutive_misses >= 3:
                    sensor.is_online = False
                    logger.info(f"Sensor {sensor.device_name} marked offline after {sensor.consecutive_misses} misses")

                sensor.save(update_fields=['consecutive_misses', 'is_online'])

        except Exception as e:
            logger.error(f"Error updating missing sensors for site {site_id}: {e}")

    @staticmethod
    def get_sensor_statistics(site_id: int):
        """
        Restituisce statistiche sensori per un sito
        """
        try:
            sensors = SensorDevice.objects.filter(site_id=site_id)

            stats = {
                'total_sensors': sensors.count(),
                'online_sensors': sensors.filter(is_online=True).count(),
                'offline_sensors': sensors.filter(is_online=False).count(),
                'active_sensors': sensors.filter(is_active=True).count(),
                'total_messages': sum(sensor.total_messages for sensor in sensors),
            }

            return stats

        except Exception as e:
            logger.error(f"Error getting sensor statistics for site {site_id}: {e}")
            return None