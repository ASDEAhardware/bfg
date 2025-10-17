from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.utils import timezone
from django.core.exceptions import ValidationError
import subprocess
import json
import re
import logging
from django.utils.html import escape
from .models import MqttConnection, Gateway, Datalogger, Sensor

logger = logging.getLogger(__name__)



@method_decorator(csrf_exempt, name='dispatch')
class MqttConnectionControlView(View):
    """
    API per controllare connessioni MQTT (start/stop/restart)
    """

    def post(self, request, site_id):
        # Validazione input di sicurezza
        try:
            site_id = int(site_id)
        except (ValueError, TypeError):
            return JsonResponse({
                'success': False,
                'error': 'Invalid site_id format'
            }, status=400)

        action = request.POST.get('action', '').strip()

        # Sanitizza input
        if not action or not re.match(r'^[a-z]+$', action):
            return JsonResponse({
                'success': False,
                'error': 'Invalid action format'
            }, status=400)

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




@method_decorator(cache_page(5), name='get')  # Cache per 5 secondi
@method_decorator(vary_on_headers('Authorization'), name='get')
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

        # Sensori online/offline per sito via nuovo modello
        sensor_stats = {}
        for conn in MqttConnection.objects.all():
            sensors = Sensor.objects.filter(datalogger__site_id=conn.site.id)
            total_sensors = sensors.count()
            online_sensors = sensors.filter(is_online=True).count()

            sensor_stats[conn.site.id] = {
                'total_sensors': total_sensors,
                'online_sensors': online_sensors,
                'offline_sensors': total_sensors - online_sensors,
                'uptime_percentage': (online_sensors / total_sensors * 100) if total_sensors > 0 else 0
            }

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
        # Validazione input
        try:
            site_id = int(site_id)
        except (ValueError, TypeError):
            return JsonResponse({
                'error': 'Invalid site_id format'
            }, status=400)

        try:
            # Ottieni tutti i sensori del sito attraverso i datalogger
            sensors = Sensor.objects.filter(
                datalogger__site_id=site_id
            ).select_related('datalogger')

            sensor_data = []
            for sensor in sensors:
                # Usa i dati integrati nel modello Sensor
                latest_reading = sensor.get_latest_readings()
                latest_data = latest_reading[0] if latest_reading else None

                sensor_info = {
                    'device_name': sensor.serial_number,
                    'label': sensor.label,
                    'is_online': sensor.is_online,
                    'last_seen_at': sensor.last_seen_at.isoformat() if sensor.last_seen_at else None,
                    'total_messages': sensor.total_messages,
                    'consecutive_misses': sensor.consecutive_misses,
                    'datalogger_name': sensor.datalogger.label,
                }

                if latest_data:
                    sensor_info.update({
                        'timestamp': latest_data['timestamp'].isoformat(),
                        'data': latest_data['data']
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
            # Validazione input
            try:
                site_id = int(site_id)
            except (ValueError, TypeError):
                return JsonResponse({
                    'error': 'Invalid site_id format'
                }, status=400)

            # Get gateway info for the site (sostituisce SystemInfo)
            gateway = Gateway.objects.get(site_id=site_id)

            return JsonResponse({
                'id': gateway.id,
                'site_id': gateway.site_id,
                'serial_number': gateway.serial_number,
                'label': gateway.label,
                'hostname': gateway.hostname,
                'ip_address': gateway.ip_address,
                'firmware_version': gateway.firmware_version,
                'is_online': gateway.is_online,
                'last_heartbeat': gateway.last_heartbeat.isoformat() if gateway.last_heartbeat else None,
                'last_communication': gateway.last_communication.isoformat() if gateway.last_communication else None,
                'cpu_usage_percent': gateway.cpu_usage_percent,
                'memory_usage_percent': gateway.memory_usage_percent,
                'disk_usage_percent': gateway.disk_usage_percent,
                'uptime_seconds': gateway.uptime_seconds,
                'raw_metadata': gateway.raw_metadata,
                'created_at': gateway.created_at.isoformat(),
                'updated_at': gateway.updated_at.isoformat(),
            })

        except Gateway.DoesNotExist:
            return JsonResponse({
                'error': 'Gateway info not found for this site'
            }, status=404)
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)


# ============================================================================
# NUOVE API VIEWS PER AUTO-DISCOVERY MQTT - REFACTORING
# ============================================================================

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Prefetch

from .models import Gateway, Datalogger, Sensor
from .serializers import (
    GatewaySerializer, DataloggerSerializer, SensorSerializer, LabelUpdateSerializer
)
from sites.models import Site


class GatewayViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet per Gateway (ex SystemInfo)
    Read-only perché auto-discovery gestisce create/update
    """
    serializer_class = GatewaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filtra gateway per siti accessibili all'utente"""
        if self.request.user.is_superuser:
            return Gateway.objects.select_related('site')

        # Filtra per accessi utente
        user_sites = Site.objects.filter(user_accesses__user=self.request.user)
        return Gateway.objects.filter(site__in=user_sites).select_related('site')

    @action(detail=True, methods=['patch'])
    def update_label(self, request, pk=None):
        """Endpoint per aggiornare label gateway"""
        gateway = self.get_object()
        serializer = LabelUpdateSerializer(data=request.data)

        if serializer.is_valid():
            gateway.label = serializer.validated_data['label']
            gateway.save(update_fields=['label'])

            return Response({
                'success': True,
                'message': 'Label aggiornata con successo',
                'label': gateway.label
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DataloggerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet per Datalogger auto-discovered
    Sostituisce /api/v1/site/dataloggers/ mantenendo compatibilità
    """
    serializer_class = DataloggerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filtra datalogger per siti accessibili + prefetch sensori"""
        queryset = Datalogger.objects.select_related('site').prefetch_related(
            Prefetch('sensors', queryset=Sensor.objects.filter(is_online=True))
        )

        if self.request.user.is_superuser:
            return queryset

        # Filtra per accessi utente
        user_sites = Site.objects.filter(user_accesses__user=self.request.user)
        return queryset.filter(site__in=user_sites)

    def list(self, request, *args, **kwargs):
        """Lista datalogger con filtri opzionali"""
        queryset = self.get_queryset()

        # Filtro per sito con validazione
        site_id = request.query_params.get('site_id')
        if site_id:
            try:
                site_id = int(site_id)
                queryset = queryset.filter(site_id=site_id)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Invalid site_id format'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Filtro per tipo con sanitizzazione
        datalogger_type = request.query_params.get('type', '').strip()
        if datalogger_type:
            # Sanitizza input per prevenire injection
            if re.match(r'^[a-zA-Z0-9_-]+$', datalogger_type):
                queryset = queryset.filter(datalogger_type=datalogger_type)
            else:
                return Response({
                    'error': 'Invalid datalogger type format'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Filtro per status
        online_only = request.query_params.get('online_only')
        if online_only and online_only.lower() == 'true':
            queryset = queryset.filter(is_online=True)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def update_label(self, request, pk=None):
        """Endpoint per aggiornare label datalogger"""
        datalogger = self.get_object()
        serializer = LabelUpdateSerializer(data=request.data)

        if serializer.is_valid():
            datalogger.label = serializer.validated_data['label']
            datalogger.save(update_fields=['label'])

            return Response({
                'success': True,
                'message': 'Label aggiornata con successo',
                'label': datalogger.label
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'])
    def soft_delete(self, request, pk=None):
        """Soft delete datalogger (marca come offline)"""
        datalogger = self.get_object()
        datalogger.is_online = False
        datalogger.save(update_fields=['is_online'])

        return Response({
            'success': True,
            'message': f'Datalogger {datalogger.label} marcato come offline'
        })


class SensorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet per Sensor con dati near real-time
    Sostituisce /api/v1/site/sensors/ mantenendo compatibilità
    """
    serializer_class = SensorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filtra sensori per siti accessibili"""
        queryset = Sensor.objects.select_related('datalogger__site')

        if self.request.user.is_superuser:
            return queryset

        # Filtra per accessi utente
        user_sites = Site.objects.filter(user_accesses__user=self.request.user)
        return queryset.filter(datalogger__site__in=user_sites)

    def list(self, request, *args, **kwargs):
        """Lista sensori con filtri"""
        queryset = self.get_queryset()

        # Filtro per datalogger
        datalogger_id = request.query_params.get('datalogger_id')
        if datalogger_id:
            queryset = queryset.filter(datalogger_id=datalogger_id)

        # Filtro per sito
        site_id = request.query_params.get('site_id')
        if site_id:
            queryset = queryset.filter(datalogger__site_id=site_id)

        # Filtro per tipo sensore
        sensor_type = request.query_params.get('sensor_type')
        if sensor_type:
            queryset = queryset.filter(sensor_type=sensor_type)

        # Solo sensori online
        online_only = request.query_params.get('online_only')
        if online_only and online_only.lower() == 'true':
            queryset = queryset.filter(is_online=True)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_datalogger(self, request):
        """
        Endpoint compatibilità: /sensors/by_datalogger/?datalogger_id=X
        Sostituisce /api/v1/site/sensors/by-datalogger/{datalogger_id}/
        """
        datalogger_id = request.query_params.get('datalogger_id')
        if not datalogger_id:
            return Response({
                'error': 'datalogger_id parameter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verifica che il datalogger esista e sia accessibile
            datalogger = Datalogger.objects.select_related('site').get(id=datalogger_id)

            if not self.request.user.is_superuser:
                user_sites = Site.objects.filter(user_accesses__user=self.request.user)
                if datalogger.site not in user_sites:
                    return Response({
                        'error': 'Access denied to this datalogger'
                    }, status=status.HTTP_403_FORBIDDEN)

            # Ottieni sensori del datalogger
            sensors = self.get_queryset().filter(datalogger=datalogger)
            serializer = self.get_serializer(sensors, many=True)

            return Response({
                'datalogger': {
                    'id': datalogger.id,
                    'label': datalogger.label,
                    'datalogger_type': datalogger.datalogger_type,
                    'is_online': datalogger.is_online,
                },
                'sensors': serializer.data,
                'count': len(serializer.data)
            })

        except Datalogger.DoesNotExist:
            return Response({
                'error': 'Datalogger not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def readings(self, request, pk=None):
        """Endpoint per ultimi dati del sensore"""
        sensor = self.get_object()
        readings = sensor.get_latest_readings()

        return Response({
            'sensor': {
                'id': sensor.id,
                'label': sensor.label,
                'serial_number': sensor.serial_number,
            },
            'readings': readings,
            'count': len(readings),
            'stats': {
                'min_ever': sensor.min_value_ever,
                'max_ever': sensor.max_value_ever,
                'total_readings': sensor.total_readings,
                'uptime_percentage': sensor.uptime_percentage,
            }
        })

    @action(detail=True, methods=['patch'])
    def update_label(self, request, pk=None):
        """Endpoint per aggiornare label sensore"""
        sensor = self.get_object()
        serializer = LabelUpdateSerializer(data=request.data)

        if serializer.is_valid():
            sensor.label = serializer.validated_data['label']
            sensor.save(update_fields=['label'])

            return Response({
                'success': True,
                'message': 'Label aggiornata con successo',
                'label': sensor.label
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'])
    def soft_delete(self, request, pk=None):
        """Soft delete sensore (marca come offline)"""
        sensor = self.get_object()
        sensor.is_online = False
        sensor.save(update_fields=['is_online'])

        return Response({
            'success': True,
            'message': f'Sensore {sensor.label} marcato come offline'
        })