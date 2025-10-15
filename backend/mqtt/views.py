from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.generic import TemplateView
from django.views import View
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
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