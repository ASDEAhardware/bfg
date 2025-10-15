from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import subprocess
import json
import re
from .models import MqttConnection, SensorDevice, SensorData
from .services.message_parser import MqttMessageParser



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
            connection = get_object_or_404(MqttConnection, site_id=site_id)

            # TODO: Implementare controllo tramite manager globale
            # Per ora solo update status nel database

            if action == 'start':
                if connection.status in ['disconnected', 'error']:
                    connection.status = 'connecting'
                    connection.save()
                    message = f'Starting connection for {connection.site.name}'
                else:
                    message = f'Connection for {connection.site.name} already active'

            elif action == 'stop':
                if connection.status == 'connected':
                    connection.status = 'disconnected'
                    connection.save()
                    message = f'Stopped connection for {connection.site.name}'
                else:
                    message = f'Connection for {connection.site.name} not active'

            elif action == 'restart':
                connection.status = 'connecting'
                connection.error_message = ''
                connection.connection_errors = 0
                connection.save()
                message = f'Restarting connection for {connection.site.name}'


            return JsonResponse({
                'success': True,
                'message': message,
                'new_status': connection.status
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)




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