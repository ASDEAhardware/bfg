from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import subprocess
import json
import re
import logging
from .models import MqttConnection, SensorDevice, SensorData, SystemInfo
from .services.message_parser import MqttMessageParser

logger = logging.getLogger(__name__)



@method_decorator(csrf_exempt, name='dispatch')
class MqttConnectionControlView(View):
    """
    API per controllare connessioni MQTT (start/stop/restart)
    """

    def post(self, request, site_id):
        action = request.POST.get('action')

        if action not in ['start', 'stop', 'restart']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid action. Use: start, stop, restart'
            }, status=400)

        try:
            # Get connection and manager instance
            connection = get_object_or_404(MqttConnection, site_id=site_id)
            from .services.mqtt_manager import MqttClientManager
            manager = MqttClientManager.get_instance()

            # Get current real state from manager (source of truth)
            is_client_active = site_id in manager.clients
            is_client_connected = is_client_active and manager.clients[site_id].is_connected()

            # Execute action with transaction-based logic
            if action == 'start':
                result = self._handle_start_connection(connection, manager, site_id, is_client_active)
            elif action == 'stop':
                result = self._handle_stop_connection(connection, manager, site_id, is_client_active)
            elif action == 'restart':
                result = self._handle_restart_connection(connection, manager, site_id)

            return JsonResponse({
                'success': True,
                'message': result['message'],
                'new_status': result['new_status'],
                'actual_state': {
                    'client_active': site_id in manager.clients,
                    'client_connected': site_id in manager.clients and manager.clients[site_id].is_connected() if site_id in manager.clients else False
                }
            })

        except Exception as e:
            logger.error(f"Error controlling MQTT connection for site {site_id}: {e}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)

    def _handle_start_connection(self, connection, manager, site_id, is_client_active):
        """Handle START action with proper state validation"""
        site_name = connection.site.name

        # Validate current state
        if is_client_active:
            client = manager.clients[site_id]
            if client.is_connected():
                return {
                    'message': f'Connection for {site_name} is already active',
                    'new_status': 'connected'
                }

        # Attempt to start connection
        try:
            # Set status to connecting BEFORE attempting connection
            connection.status = 'connecting'
            connection.error_message = ''
            connection.save(update_fields=['status', 'error_message'])

            # Try to start via manager
            success = manager.start_connection(site_id)

            if success:
                # Manager should update DB status, but let's be sure
                connection.refresh_from_db()
                return {
                    'message': f'Successfully started connection for {site_name}',
                    'new_status': connection.status
                }
            else:
                # Connection failed, update status
                connection.status = 'error'
                connection.error_message = 'Failed to start connection'
                connection.save(update_fields=['status', 'error_message'])

                return {
                    'message': f'Failed to start connection for {site_name}',
                    'new_status': 'error'
                }

        except Exception as e:
            # Rollback on error
            connection.status = 'error'
            connection.error_message = str(e)
            connection.save(update_fields=['status', 'error_message'])
            raise

    def _handle_stop_connection(self, connection, manager, site_id, is_client_active):
        """Handle STOP action with proper state validation"""
        site_name = connection.site.name

        # Validate current state
        if not is_client_active:
            return {
                'message': f'Connection for {site_name} is already stopped',
                'new_status': 'disconnected'
            }

        # Attempt to stop connection
        try:
            # Stop via manager first
            manager.stop_connection(site_id)

            # Update DB status
            connection.status = 'disconnected'
            connection.error_message = ''
            connection.save(update_fields=['status', 'error_message'])

            return {
                'message': f'Successfully stopped connection for {site_name}',
                'new_status': 'disconnected'
            }

        except Exception as e:
            # Don't rollback stop operations - if manager failed, at least try to update DB
            connection.status = 'error'
            connection.error_message = f'Stop operation failed: {str(e)}'
            connection.save(update_fields=['status', 'error_message'])
            raise

    def _handle_restart_connection(self, connection, manager, site_id):
        """Handle RESTART action with proper state validation"""
        site_name = connection.site.name

        try:
            # Set status to connecting
            connection.status = 'connecting'
            connection.error_message = ''
            connection.save(update_fields=['status', 'error_message'])

            # Execute restart via manager (this should handle everything)
            success = manager.restart_connection(site_id)

            # Get updated status from DB (manager should have updated it)
            connection.refresh_from_db()

            if success or connection.status == 'connected':
                return {
                    'message': f'Successfully restarted connection for {site_name}',
                    'new_status': connection.status
                }
            else:
                return {
                    'message': f'Restart initiated for {site_name} - check status',
                    'new_status': connection.status
                }

        except Exception as e:
            # Update error state
            connection.status = 'error'
            connection.error_message = str(e)
            connection.save(update_fields=['status', 'error_message'])
            raise




class MqttApiStatusView(View):
    """
    API per status real-time (per AJAX polling)
    """

    def get(self, request):
        # Status generale
        connections = MqttConnection.objects.select_related('site').values(
            'id', 'site_id', 'site__name', 'site__code', 'status', 'last_connected_at',
            'last_heartbeat_at', 'connection_errors', 'error_message'
        )

        # Sensori online/offline per sito
        sensor_stats = {}
        for conn in MqttConnection.objects.all():
            stats = MqttMessageParser.get_sensor_statistics(conn.site.id)
            sensor_stats[conn.site.id] = stats

        return JsonResponse({
            'connections': list(connections),
            'sensor_stats': sensor_stats,
            'timestamp': timezone.now().isoformat()
        })


class MqttApiSensorDataView(View):
    """
    API per dati sensori real-time
    """

    def get(self, request, site_id):
        try:
            # Ultimi dati per tutti i sensori del sito
            sensors = SensorDevice.objects.filter(site_id=site_id)

            sensor_data = []
            for sensor in sensors:
                latest_data = SensorData.objects.filter(
                    sensor_device=sensor
                ).order_by('-timestamp').first()

                sensor_info = {
                    'device_name': sensor.device_name,
                    'is_online': sensor.is_online,
                    'last_seen_at': sensor.last_seen_at.isoformat() if sensor.last_seen_at else None,
                    'total_messages': sensor.total_messages,
                    'consecutive_misses': sensor.consecutive_misses,
                }

                if latest_data:
                    sensor_info.update({
                        'timestamp': latest_data.timestamp.isoformat(),
                        'acc_x': latest_data.acc_x,
                        'acc_y': latest_data.acc_y,
                        'acc_z': latest_data.acc_z,
                        'incli_x': latest_data.incli_x,
                        'incli_y': latest_data.incli_y,
                        'mag_x': latest_data.mag_x,
                        'mag_y': latest_data.mag_y,
                        'mag_z': latest_data.mag_z,
                        'gyro_x': latest_data.gyro_x,
                        'gyro_y': latest_data.gyro_y,
                        'gyro_z': latest_data.gyro_z,
                    })

                sensor_data.append(sensor_info)

            return JsonResponse({
                'sensors': sensor_data,
                'timestamp': timezone.now().isoformat()
            })

        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)


class MqttServiceStatusView(View):
    """
    API per controllare status del daemon MQTT
    """

    def get(self, request):
        try:
            # Usa il singleton MQTT manager per status real-time
            from .services.mqtt_manager import MqttClientManager
            from django.core.cache import cache

            # Controlla se Django ha avviato il servizio
            service_started = cache.get('mqtt_manager_started', False)

            # Ottieni status dal manager
            try:
                manager = MqttClientManager.get_instance()
                manager_status = manager.get_connection_status()

                is_running = service_started and manager_status['active_clients'] > 0

                return JsonResponse({
                    'is_running': is_running,
                    'process_count': 1 if service_started else 0,
                    'uptime': "Running via Django AppConfig" if is_running else None,
                    'manager_status': manager_status,
                    'service_started': service_started,
                    'active_connections': manager_status['connected'],
                    'total_connections': manager_status['total_configured'],
                    'enabled_connections': manager_status.get('enabled_connections'),
                    'disabled_connections': manager_status.get('disabled_connections')
                })

            except Exception as e:
                # Fallback: controlla processi manualmente
                import os
                processes = []
                for line in os.popen("ps aux 2>/dev/null || ps -ef").readlines():
                    if "run_mqtt" in line and "python" in line and "manage.py" in line:
                        processes.append(line.strip())

                return JsonResponse({
                    'is_running': len(processes) > 0,
                    'process_count': len(processes),
                    'uptime': None,
                    'fallback_mode': True,
                    'processes': processes[:3]
                })

        except Exception as e:
            return JsonResponse({
                'is_running': False,
                'process_count': 0,
                'error': str(e)
            }, status=500)




@method_decorator(csrf_exempt, name='dispatch')
class MqttServiceControlView(View):
    """
    API per controllare il servizio MQTT (start/stop/restart)
    """

    def post(self, request):
        try:
            data = json.loads(request.body)
            action = data.get('action')

            if action not in ['restart']:
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid action. Only "restart" is supported (service auto-starts with Django)'
                }, status=400)

            if action == 'restart':
                # Usa il singleton manager per restart pulito
                from .services.mqtt_manager import MqttClientManager
                from django.core.cache import cache

                try:
                    manager = MqttClientManager.get_instance()

                    # Restart completo del manager
                    manager.restart_all_connections()

                    # Aggiorna cache status
                    cache.set('mqtt_manager_started', True, timeout=None)

                    message = "MQTT service restarted successfully"

                except Exception as e:
                    return JsonResponse({
                        'success': False,
                        'error': f'Failed to restart MQTT service: {str(e)}'
                    }, status=500)

            return JsonResponse({
                'success': True,
                'message': message,
                'action': action
            })

        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON payload'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)


class MqttApiSystemInfoView(View):
    """
    API per system info di un sito specifico
    """

    def get(self, request, site_id):
        try:
            # Get system info for the site
            system_info = SystemInfo.objects.get(site_id=site_id)

            return JsonResponse({
                'id': system_info.id,
                'site_id': system_info.site_id,
                'hostname': system_info.hostname,
                'ip_address': system_info.ip_address,
                'mac_address': system_info.mac_address,
                'cpu_model': system_info.cpu_model,
                'cpu_cores': system_info.cpu_cores,
                'cpu_frequency': system_info.cpu_frequency,
                'total_memory': system_info.total_memory,
                'total_storage': system_info.total_storage,
                'used_storage': system_info.used_storage,
                'available_storage': system_info.available_storage,
                'os_name': system_info.os_name,
                'os_version': system_info.os_version,
                'kernel_version': system_info.kernel_version,
                'uptime_seconds': system_info.uptime_seconds,
                'boot_time': system_info.boot_time.isoformat() if system_info.boot_time else None,
                'cpu_usage_percent': system_info.cpu_usage_percent,
                'memory_usage_percent': system_info.memory_usage_percent,
                'disk_usage_percent': system_info.disk_usage_percent,
                'network_interfaces': system_info.network_interfaces,
                'cpu_temperature': system_info.cpu_temperature,
                'system_sensors': system_info.system_sensors,
                'python_version': system_info.python_version,
                'installed_packages': system_info.installed_packages,
                'raw_data': system_info.raw_data,
                'last_updated': system_info.last_updated.isoformat(),
                'created_at': system_info.created_at.isoformat(),
            })

        except SystemInfo.DoesNotExist:
            return JsonResponse({
                'error': 'System info not found for this site'
            }, status=404)
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)