import json
import logging
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from ..models import MqttConnection, SensorDevice, SensorData, SystemInfo

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
        Parse sys_info message and save/update system information

        Esempio payload:
        {
            "hostname": "datalogger-001",
            "ip_address": "192.168.1.100",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "cpu_model": "ARM Cortex-A72",
            "cpu_cores": 4,
            "cpu_frequency": 1500.0,
            "total_memory": 4294967296,
            "total_storage": 64000000000,
            "used_storage": 12800000000,
            "available_storage": 51200000000,
            "os_name": "Linux",
            "os_version": "Ubuntu 22.04",
            "kernel_version": "5.15.0-91-generic",
            "uptime_seconds": 3600,
            "boot_time": "2025-10-16T10:00:00Z",
            "cpu_usage_percent": 15.5,
            "memory_usage_percent": 45.2,
            "disk_usage_percent": 20.0,
            "network_interfaces": {...},
            "cpu_temperature": 45.0,
            "system_sensors": {...},
            "python_version": "3.10.12",
            "installed_packages": [...]
        }
        """
        try:
            data = json.loads(payload)

            with transaction.atomic():
                # Get or create SystemInfo for this site
                system_info, created = SystemInfo.objects.get_or_create(
                    site_id=site_id,
                    defaults={'raw_data': data}
                )

                if created:
                    logger.info(f"Created new SystemInfo for site {site_id}")

                # Extract system info from nested structure or direct format
                system_data = data.get('system', data)  # Fallback to root if no 'system' key
                docker_data = data.get('docker', {})

                # Handle different message formats
                if 'system' in data:
                    # New nested format
                    system_info.hostname = data.get('hostname', '')
                    system_info.ip_address = data.get('ip_address')
                    system_info.mac_address = data.get('mac_address', '')

                    # Extract from system section - preserve existing values if new data is empty/null
                    new_os_version = system_data.get('os_version', '')
                    if new_os_version:  # Only update if not empty
                        system_info.os_version = new_os_version

                    new_cpu = system_data.get('cpu_load_percent')
                    if new_cpu is not None:  # Only update if not None
                        system_info.cpu_usage_percent = new_cpu

                    new_ram = system_data.get('ram_percent_used')
                    if new_ram is not None:  # Only update if not None
                        system_info.memory_usage_percent = new_ram

                    new_disk = system_data.get('disk_percent_used')
                    if new_disk is not None:  # Only update if not None
                        system_info.disk_usage_percent = new_disk

                    # Memory calculations
                    ram_total_gb = system_data.get('ram_total_gb')
                    if ram_total_gb:
                        system_info.total_memory = int(ram_total_gb * 1024**3)  # Convert GB to bytes

                    # Storage calculations
                    disk_total_gb = system_data.get('disk_total_gb')
                    if disk_total_gb:
                        system_info.total_storage = int(disk_total_gb * 1024**3)  # Convert GB to bytes

                    disk_free_gb = system_data.get('disk_free_gb')
                    if disk_free_gb and disk_total_gb:
                        system_info.used_storage = int((disk_total_gb - disk_free_gb) * 1024**3)
                        system_info.available_storage = int(disk_free_gb * 1024**3)

                    # Parse system uptime
                    uptime_str = system_data.get('system_uptime')
                    if uptime_str:
                        try:
                            # Parse "10 days, 3:46:14" format
                            import re
                            days_match = re.search(r'(\d+) days?', uptime_str)
                            time_match = re.search(r'(\d+):(\d+):(\d+)', uptime_str)

                            total_seconds = 0
                            if days_match:
                                total_seconds += int(days_match.group(1)) * 86400
                            if time_match:
                                hours, minutes, seconds = map(int, time_match.groups())
                                total_seconds += hours * 3600 + minutes * 60 + seconds

                            if total_seconds > 0:
                                system_info.uptime_seconds = total_seconds
                        except (ValueError, AttributeError):
                            logger.warning(f"Could not parse uptime: {uptime_str}")

                    # Set OS name from version
                    if system_info.os_version:
                        system_info.os_name = 'Linux' if 'Ubuntu' in system_info.os_version else 'Unknown'

                else:
                    # Original direct format
                    system_info.hostname = data.get('hostname', '')
                    system_info.ip_address = data.get('ip_address')
                    system_info.mac_address = data.get('mac_address', '')
                    system_info.cpu_model = data.get('cpu_model', '')
                    system_info.cpu_cores = data.get('cpu_cores')
                    system_info.cpu_frequency = data.get('cpu_frequency')
                    system_info.total_memory = data.get('total_memory')
                    system_info.total_storage = data.get('total_storage')
                    system_info.used_storage = data.get('used_storage')
                    system_info.available_storage = data.get('available_storage')
                    system_info.os_name = data.get('os_name', '')
                    system_info.os_version = data.get('os_version', '')
                    system_info.kernel_version = data.get('kernel_version', '')
                    system_info.uptime_seconds = data.get('uptime_seconds')
                    system_info.cpu_usage_percent = data.get('cpu_usage_percent')
                    system_info.memory_usage_percent = data.get('memory_usage_percent')
                    system_info.disk_usage_percent = data.get('disk_usage_percent')
                    system_info.cpu_temperature = data.get('cpu_temperature')
                    system_info.python_version = data.get('python_version', '')
                    system_info.installed_packages = data.get('installed_packages', [])

                    # Parse boot_time if provided
                    boot_time_str = data.get('boot_time')
                    if boot_time_str:
                        try:
                            boot_time = datetime.fromisoformat(boot_time_str.replace('Z', '+00:00'))
                            system_info.boot_time = boot_time
                        except ValueError:
                            logger.warning(f"Invalid boot_time format: {boot_time_str}")

                # Network and sensors (JSON fields) - always store full data
                system_info.network_interfaces = data.get('network_interfaces', {})
                system_info.system_sensors = data.get('system_sensors', {})

                # Store raw data for debugging
                system_info.raw_data = data

                # Save updates
                system_info.save()

                logger.info(f"Updated SystemInfo for site {site_id}: {system_info.hostname} | CPU: {system_info.cpu_usage_percent}% | RAM: {system_info.memory_usage_percent}% | OS: '{system_info.os_version}'")
                return True

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in sys_info for site {site_id}: {e}")
            return False
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