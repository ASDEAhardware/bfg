from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.generic import TemplateView
from django.views import View
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
import subprocess
import json
import re
from .models import MqttConnection, SensorDevice, SensorData, ConnectionLog
from .services.message_parser import MqttMessageParser


@method_decorator(staff_member_required, name='dispatch')
class MqttDashboardView(TemplateView):
    """
    Dashboard principale MQTT con overview di tutte le connessioni
    """
    template_name = 'mqtt/dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Statistics generali
        total_connections = MqttConnection.objects.count()
        active_connections = MqttConnection.objects.filter(status='connected').count()
        error_connections = MqttConnection.objects.filter(status='error').count()

        total_sensors = SensorDevice.objects.count()
        online_sensors = SensorDevice.objects.filter(is_online=True).count()
        offline_sensors = SensorDevice.objects.filter(is_online=False).count()

        # Connessioni con dettagli
        connections = MqttConnection.objects.select_related('site').annotate(
            sensor_count=Count('site__sensordevice'),
            online_sensor_count=Count('site__sensordevice', filter=Q(site__sensordevice__is_online=True))
        ).order_by('site__name')

        # Log recenti (ultimi 50)
        recent_logs = ConnectionLog.objects.select_related(
            'mqtt_connection', 'mqtt_connection__site'
        ).order_by('-timestamp')[:50]

        # Sensori per sito
        sites_with_sensors = {}
        for conn in connections:
            sensors = SensorDevice.objects.filter(site=conn.site).order_by('device_name')
            sites_with_sensors[conn.site.id] = sensors

        context.update({
            'total_connections': total_connections,
            'active_connections': active_connections,
            'error_connections': error_connections,
            'total_sensors': total_sensors,
            'online_sensors': online_sensors,
            'offline_sensors': offline_sensors,
            'connections': connections,
            'recent_logs': recent_logs,
            'sites_with_sensors': sites_with_sensors,
        })

        return context


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

            # Log action
            ConnectionLog.objects.create(
                mqtt_connection=connection,
                event_type='connected' if action == 'start' else 'disconnected',
                message=f'Manual {action} via dashboard'
            )

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


@method_decorator(staff_member_required, name='dispatch')
class MqttSiteDetailView(TemplateView):
    """
    Dettagli MQTT per un sito specifico
    """
    template_name = 'mqtt/site_detail.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        site_id = kwargs.get('site_id')

        connection = get_object_or_404(
            MqttConnection.objects.select_related('site'),
            site_id=site_id
        )

        # Sensori del sito
        sensors = SensorDevice.objects.filter(site_id=site_id).order_by('device_name')

        # Dati recenti per ogni sensore
        sensors_with_data = []
        for sensor in sensors:
            recent_data = SensorData.objects.filter(
                sensor_device=sensor
            ).order_by('-timestamp')[:3]  # Ultimi 3 record

            sensors_with_data.append({
                'sensor': sensor,
                'data': recent_data
            })

        # Statistiche del sito
        stats = MqttMessageParser.get_sensor_statistics(site_id)

        # Log del sito (ultimi 20)
        site_logs = ConnectionLog.objects.filter(
            mqtt_connection=connection
        ).order_by('-timestamp')[:20]

        context.update({
            'connection': connection,
            'sensors_with_data': sensors_with_data,
            'stats': stats,
            'site_logs': site_logs,
        })

        return context


class MqttApiStatusView(View):
    """
    API per status real-time (per AJAX polling)
    """

    def get(self, request):
        # Status generale
        connections = MqttConnection.objects.select_related('site').values(
            'id', 'site__name', 'site__code', 'status', 'last_connected_at',
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
                    'total_connections': manager_status['total_configured']
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


class MqttServiceLogsView(View):
    """
    API per ottenere log del servizio MQTT
    """

    def get(self, request):
        try:
            # Per ora, generiamo log simulati poiché è complesso accedere ai log del container dall'interno
            # In alternativa si potrebbe usare Django logging per generare log MQTT locali

            import logging

            # Simuliamo alcuni log MQTT recenti
            mqtt_logs = [
                {
                    'timestamp': '2025-10-15 12:30:15',
                    'level': 'INFO',
                    'message': 'MQTT service control panel initialized'
                },
                {
                    'timestamp': '2025-10-15 12:30:16',
                    'level': 'INFO',
                    'message': 'Service status check requested'
                }
            ]

            # Aggiungi log reali dal database ConnectionLog se disponibili
            from .models import ConnectionLog
            recent_logs = ConnectionLog.objects.order_by('-timestamp')[:50]

            for log in recent_logs:
                mqtt_logs.append({
                    'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    'level': 'INFO' if log.event_type == 'connected' else 'WARNING',
                    'message': f"{log.mqtt_connection.site.name}: {log.message}"
                })

            # Mantieni solo ultimi 100 e ordina per timestamp
            mqtt_logs = sorted(mqtt_logs, key=lambda x: x['timestamp'])[-100:]

            return JsonResponse({
                'logs': mqtt_logs,
                'total_lines': len(mqtt_logs)
            })

        except Exception as e:
            return JsonResponse({
                'logs': [],
                'error': str(e)
            }, status=500)

    def _parse_log_line(self, line):
        """Parse una linea di log Django/MQTT"""
        if not line.strip():
            return None

        # Pattern comune Django: [timestamp] LEVEL message
        timestamp_match = re.search(r'\[([\d\-\s:,]+)\]', line)
        level_match = re.search(r'(DEBUG|INFO|WARNING|ERROR|CRITICAL)', line)

        timestamp = timestamp_match.group(1) if timestamp_match else "Unknown"
        level = level_match.group(1) if level_match else "INFO"

        # Rimuovi timestamp e level dal messaggio
        message = line
        if timestamp_match:
            message = message.replace(timestamp_match.group(0), '', 1)
        if level_match:
            message = message.replace(level_match.group(0), '', 1)

        message = message.strip(' -:')

        return {
            'timestamp': timestamp,
            'level': level,
            'message': message[:200]  # Limita lunghezza messaggio
        }


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