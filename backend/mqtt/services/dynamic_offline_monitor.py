"""
Dynamic Offline Monitoring System
Gestisce monitoring offline basato su frequenze reali dei dispositivi
"""
import threading
import time
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from django.utils import timezone
from django.db import transaction
import logging

logger = logging.getLogger(__name__)


@dataclass
class DeviceHeartbeatConfig:
    """Configurazione heartbeat per un singolo device"""
    device_id: str
    device_type: str  # 'gateway', 'datalogger', 'sensor'
    expected_interval_seconds: int
    tolerance_seconds: int = 1
    max_missed_heartbeats: int = 3
    last_heartbeat: datetime = None
    next_expected_heartbeat: datetime = None
    status: str = 'online'  # 'online', 'warning', 'offline'
    consecutive_misses: int = 0
    site_id: int = None


class DynamicOfflineMonitor:
    """Monitor principale per gestire heartbeat dinamici"""

    def __init__(self):
        self.device_configs: Dict[str, DeviceHeartbeatConfig] = {}
        self.monitoring_thread = None
        self.stop_monitoring = threading.Event()
        self.check_interval = 1  # Check every second for precision
        self.status_updater = DeviceStatusUpdater()
        self.tolerance_manager = AdaptiveToleranceManager()

    def start_monitoring(self):
        """Avvia il monitoring thread"""
        if self.monitoring_thread and self.monitoring_thread.is_alive():
            logger.warning("Monitoring thread already running")
            return

        self.stop_monitoring.clear()
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        logger.info("Dynamic offline monitoring started")

    def stop_monitoring_service(self):
        """Ferma il monitoring thread"""
        self.stop_monitoring.set()
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        logger.info("Dynamic offline monitoring stopped")

    def register_device_heartbeat(self, device_id: str, device_type: str,
                                interval_seconds: int, timestamp: datetime = None,
                                site_id: int = None):
        """Registra/aggiorna configurazione heartbeat per un device"""
        if timestamp is None:
            timestamp = timezone.now()

        # Calcola tolleranza adattiva se abbiamo storico
        tolerance = self.tolerance_manager.calculate_adaptive_tolerance(
            device_id, interval_seconds
        )

        config = DeviceHeartbeatConfig(
            device_id=device_id,
            device_type=device_type,
            expected_interval_seconds=interval_seconds,
            tolerance_seconds=tolerance,
            last_heartbeat=timestamp,
            next_expected_heartbeat=timestamp + timedelta(seconds=interval_seconds),
            site_id=site_id
        )

        # Check se device era offline e ora è tornato online
        old_config = self.device_configs.get(device_id)
        was_offline = old_config and old_config.status in ['warning', 'offline']

        self.device_configs[device_id] = config

        if was_offline:
            self._handle_device_recovery(config)
        else:
            logger.debug(f"Device {device_id} registered/updated - interval: {interval_seconds}s, tolerance: {tolerance}s")

        # Update tolerance history se abbiamo config precedente
        if old_config:
            actual_interval = (timestamp - old_config.last_heartbeat).total_seconds()
            self.tolerance_manager.update_interval_history(device_id, actual_interval)

    def _monitoring_loop(self):
        """Loop principale di monitoring"""
        while not self.stop_monitoring.is_set():
            try:
                self._check_all_devices()
                time.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.check_interval)

    def _check_all_devices(self):
        """Controlla tutti i device per timeout"""
        current_time = timezone.now()

        for device_id, config in self.device_configs.items():
            try:
                if current_time >= config.next_expected_heartbeat:
                    self._handle_missed_heartbeat(config, current_time)
            except Exception as e:
                logger.error(f"Error checking device {device_id}: {e}")

    def _handle_missed_heartbeat(self, config: DeviceHeartbeatConfig, current_time: datetime):
        """Gestisce un heartbeat mancato"""
        time_since_last = (current_time - config.last_heartbeat).total_seconds()
        expected_with_tolerance = config.expected_interval_seconds + config.tolerance_seconds

        if time_since_last > expected_with_tolerance:
            missed_cycles = int(time_since_last / config.expected_interval_seconds)
            config.consecutive_misses = missed_cycles

            if config.status == 'online' and missed_cycles >= 1:
                self._mark_device_warning(config, missed_cycles)
            elif config.status == 'warning' and missed_cycles >= config.max_missed_heartbeats:
                self._mark_device_offline(config, missed_cycles)

            # Update next expected heartbeat per evitare spam
            config.next_expected_heartbeat = current_time + timedelta(
                seconds=config.expected_interval_seconds
            )

    def _mark_device_warning(self, config: DeviceHeartbeatConfig, missed_cycles: int):
        """Marca device come warning (primo heartbeat mancato)"""
        config.status = 'warning'
        logger.warning(f"Device {config.device_id} ({config.device_type}) missed {missed_cycles} heartbeat(s) - WARNING")

        # Update database status
        self.status_updater.update_device_status(config, is_online=True, status_flag='warning')

    def _mark_device_offline(self, config: DeviceHeartbeatConfig, missed_cycles: int):
        """Marca device come offline dopo max_missed_heartbeats"""
        config.status = 'offline'
        logger.error(f"Device {config.device_id} ({config.device_type}) is OFFLINE - missed {missed_cycles} heartbeats")

        # Update database status
        self.status_updater.update_device_status(config, is_online=False, status_flag='offline')

        # Record downtime event
        self._record_downtime_event(config)

    def _handle_device_recovery(self, config: DeviceHeartbeatConfig):
        """Gestisce il recovery di un device"""
        logger.info(f"Device {config.device_id} ({config.device_type}) recovered and is back ONLINE")

        config.status = 'online'
        config.consecutive_misses = 0

        # Update database status
        self.status_updater.update_device_status(config, is_online=True, status_flag='online')

        # Record recovery in downtime event
        self._record_recovery_event(config)

    def _record_downtime_event(self, config: DeviceHeartbeatConfig):
        """Registra evento downtime"""
        try:
            from ..models import MqttDowntimeEvent

            # Calculate when device actually went offline (accounting for tolerance)
            offline_time = config.last_heartbeat + timedelta(
                seconds=config.expected_interval_seconds + config.tolerance_seconds
            )

            MqttDowntimeEvent.objects.create(
                device_id=config.device_id,
                device_type=config.device_type,
                site_id=config.site_id,
                offline_at=offline_time,
                expected_interval_seconds=config.expected_interval_seconds
            )

        except Exception as e:
            logger.error(f"Error recording downtime event for {config.device_id}: {e}")

    def _record_recovery_event(self, config: DeviceHeartbeatConfig):
        """Aggiorna evento downtime con recovery"""
        try:
            from ..models import MqttDowntimeEvent

            # Find the latest open downtime event for this device
            downtime_event = MqttDowntimeEvent.objects.filter(
                device_id=config.device_id,
                online_at__isnull=True
            ).order_by('-offline_at').first()

            if downtime_event:
                downtime_event.online_at = config.last_heartbeat
                downtime_event.downtime_seconds = int(
                    (config.last_heartbeat - downtime_event.offline_at).total_seconds()
                )
                downtime_event.save()

        except Exception as e:
            logger.error(f"Error recording recovery event for {config.device_id}: {e}")


class DeviceStatusUpdater:
    """Gestisce aggiornamenti status nel database"""

    def update_device_status(self, config: DeviceHeartbeatConfig, is_online: bool, status_flag: str):
        """Aggiorna status nel database basato sul tipo di device"""
        try:
            if config.device_type == 'gateway':
                self._update_gateway_status(config, is_online, status_flag)
            elif config.device_type == 'datalogger':
                self._update_datalogger_status(config, is_online, status_flag)
            elif config.device_type == 'sensor':
                self._update_sensor_status(config, is_online, status_flag)
        except Exception as e:
            logger.error(f"Error updating {config.device_type} {config.device_id} status: {e}")

    def _update_gateway_status(self, config: DeviceHeartbeatConfig, is_online: bool, status_flag: str):
        """Aggiorna status gateway e propaga a datalogger figli"""
        try:
            from ..models import Gateway

            with transaction.atomic():
                gateway = Gateway.objects.get(serial_number=config.device_id)
                gateway.is_online = is_online
                gateway.connection_status = status_flag
                gateway.expected_heartbeat_interval = config.expected_interval_seconds
                gateway.last_status_change = timezone.now()

                if not is_online:
                    gateway.last_offline_at = timezone.now()
                    # Cascade offline status to child dataloggers
                    gateway.dataloggers.update(
                        is_online=False,
                        connection_status='gateway_offline',
                        last_status_change=timezone.now()
                    )

                gateway.save()

        except Exception as e:
            logger.error(f"Error updating gateway {config.device_id}: {e}")

    def _update_datalogger_status(self, config: DeviceHeartbeatConfig, is_online: bool, status_flag: str):
        """Aggiorna status datalogger e propaga a sensori figli"""
        try:
            from ..models import Datalogger

            with transaction.atomic():
                datalogger = Datalogger.objects.get(serial_number=config.device_id)
                datalogger.is_online = is_online
                datalogger.connection_status = status_flag
                datalogger.expected_heartbeat_interval = config.expected_interval_seconds
                datalogger.last_status_change = timezone.now()

                if not is_online:
                    datalogger.last_offline_at = timezone.now()
                    # Cascade offline status to child sensors
                    datalogger.sensors.update(
                        is_online=False,
                        connection_status='datalogger_offline',
                        last_status_change=timezone.now()
                    )

                datalogger.save()

        except Exception as e:
            logger.error(f"Error updating datalogger {config.device_id}: {e}")

    def _update_sensor_status(self, config: DeviceHeartbeatConfig, is_online: bool, status_flag: str):
        """Aggiorna status sensore"""
        try:
            from ..models import Sensor

            with transaction.atomic():
                sensor = Sensor.objects.get(serial_number=config.device_id)
                sensor.is_online = is_online
                sensor.connection_status = status_flag
                sensor.expected_heartbeat_interval = config.expected_interval_seconds
                sensor.last_status_change = timezone.now()

                if not is_online:
                    sensor.last_offline_at = timezone.now()
                    sensor.consecutive_misses = config.consecutive_misses
                else:
                    sensor.consecutive_misses = 0

                sensor.save()

        except Exception as e:
            logger.error(f"Error updating sensor {config.device_id}: {e}")


class AdaptiveToleranceManager:
    """Gestisce tolleranze adattive basate sui pattern reali"""

    def __init__(self):
        self.tolerance_history: Dict[str, List[float]] = {}
        self.max_history_size = 50

    def calculate_adaptive_tolerance(self, device_id: str, declared_interval: int) -> int:
        """Calcola tolleranza adattiva basata sui pattern reali del device"""
        actual_intervals = self.tolerance_history.get(device_id, [])

        if len(actual_intervals) < 5:
            # Non abbastanza dati, usa tolleranza standard
            return max(1, declared_interval // 10)  # 10% tolerance, min 1s

        # Calcola deviazione standard degli intervalli reali
        try:
            std_dev = statistics.stdev(actual_intervals)
            # Tolleranza = 2 * standard deviation + buffer
            adaptive_tolerance = int(2 * std_dev) + 1

            # Limita la tolleranza tra 1 secondo e 50% dell'intervallo
            min_tolerance = 1
            max_tolerance = declared_interval // 2

            tolerance = max(min_tolerance, min(adaptive_tolerance, max_tolerance))

            logger.debug(f"Adaptive tolerance for {device_id}: {tolerance}s (std_dev: {std_dev:.2f})")
            return tolerance

        except Exception as e:
            logger.error(f"Error calculating adaptive tolerance for {device_id}: {e}")
            return max(1, declared_interval // 10)

    def update_interval_history(self, device_id: str, actual_interval: float):
        """Aggiorna storia degli intervalli reali per un device"""
        if device_id not in self.tolerance_history:
            self.tolerance_history[device_id] = []

        history = self.tolerance_history[device_id]
        history.append(actual_interval)

        # Mantieni solo gli ultimi N valori
        if len(history) > self.max_history_size:
            history.pop(0)


# Global instance
dynamic_monitor = DynamicOfflineMonitor()