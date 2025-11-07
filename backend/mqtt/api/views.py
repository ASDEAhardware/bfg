"""
API Views per controllo MQTT
"""
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from ..services.mqtt_service import mqtt_service
from ..models import MqttConnection, Datalogger, Sensor, DiscoveredTopic
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
from .serializers import (
    MqttConnectionStatusSerializer,
    MqttControlResponseSerializer,
    MqttManagerStatusSerializer,
    MqttConnectionListSerializer,
    DataloggerSerializer,
    SensorSerializer,
    DataloggerDetailSerializer,
    SensorDetailSerializer
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_connection(request, site_id):
    """
    Avvia connessione MQTT per un sito specifico.

    POST /v1/mqtt/sites/{site_id}/start/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'success': False, 'message': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(f"API request to start MQTT connection for site {site_id} by user {request.user}")

        conn, created = MqttConnection.objects.update_or_create(
            site_id=int(site_id),
            defaults={'is_enabled': True}
        )

        result = {
            'success': True,
            'message': f'Site {site_id} enabled. Connection will be started by the monitor shortly.'
        }

        serializer = MqttControlResponseSerializer(data=result)
        if serializer.is_valid():
            response_status = status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST
            return Response(serializer.data, status=response_status)
        else:
            return Response(serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in start_connection API for site {site_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_connection(request, site_id):
    """
    Ferma connessione MQTT per un sito specifico.

    POST /v1/mqtt/sites/{site_id}/stop/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'success': False, 'message': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(f"API request to stop MQTT connection for site {site_id} by user {request.user}")

        updated_count = MqttConnection.objects.filter(site_id=int(site_id)).update(is_enabled=False)

        if updated_count == 0:
            return Response(
                {'success': False, 'message': f'Site {site_id} not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        result = {
            'success': True,
            'message': f'Site {site_id} disabled. Connection will be stopped by the monitor shortly.'
        }

        serializer = MqttControlResponseSerializer(data=result)
        if serializer.is_valid():
            response_status = status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST
            return Response(serializer.data, status=response_status)
        else:
            return Response(serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in stop_connection API for site {site_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connection_status(request, site_id):
    """
    Ottiene stato connessione MQTT per un sito specifico.

    GET /v1/mqtt/sites/{site_id}/status/
    """
    try:
        connection_status_data = mqtt_service.get_connection_status(site_id=int(site_id))

        if connection_status_data is None:
            return Response(
                {'error': f'No MQTT connection found for site {site_id}'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MqttConnectionStatusSerializer(data=connection_status_data)
        if serializer.is_valid():
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except ValueError:
        return Response(
            {'error': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in connection_status API for site {site_id}: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_status(request):
    """
    Ottiene stato generale del manager MQTT.

    GET /v1/mqtt/manager/status/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'error': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )


        all_connections = mqtt_service.get_all_connections_status()

        # Calcola statistiche
        total_connections = len(all_connections)
        active_connections = len([c for c in all_connections if c.get('is_enabled', False)])
        connected_connections = len([c for c in all_connections if c.get('handler_connected', False)])
        error_connections = len([c for c in all_connections if c.get('status') == 'error'])

        status_data = {
            'is_running': mqtt_service.is_running(),
            'total_connections': total_connections,
            'active_connections': active_connections,
            'connected_connections': connected_connections,
            'error_connections': error_connections,
            'timestamp': datetime.now().isoformat()
        }

        serializer = MqttManagerStatusSerializer(data=status_data)
        if serializer.is_valid():
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Error in manager_status API: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_connections_status(request):
    """
    Ottiene stato dettagliato di tutte le connessioni MQTT.

    GET /v1/mqtt/connections/status/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'error': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )


        all_connections = mqtt_service.get_all_connections_status()

        # Serializza ogni connessione
        serialized_connections = []
        for connection_data in all_connections:
            serializer = MqttConnectionStatusSerializer(data=connection_data)
            if serializer.is_valid():
                serialized_connections.append(serializer.data)
            else:
                logger.error(f"Invalid connection data: {serializer.errors}")

        return Response({
            'connections': serialized_connections,
            'total_count': len(serialized_connections),
            'timestamp': datetime.now().isoformat()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in all_connections_status API: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def connections_list(request):
    """
    Lista tutte le connessioni MQTT configurate nel DB.

    GET /v1/mqtt/connections/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'error': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )


        connections = MqttConnection.objects.select_related('site').all()
        serializer = MqttConnectionListSerializer(connections, many=True)

        return Response({
            'connections': serializer.data,
            'total_count': len(serializer.data)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in connections_list API: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def restart_manager(request):
    """
    Riavvia completamente il manager MQTT.

    POST /v1/mqtt/manager/restart/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'success': False, 'message': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(f"API request to restart MQTT manager by user {request.user}")

        # Ferma manager
        stop_success = mqtt_service.stop()
        if not stop_success:
            return Response(
                {'success': False, 'message': 'Failed to stop MQTT manager'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Attendi un momento per cleanup
        import time
        time.sleep(2)

        # Riavvia manager
        start_success = mqtt_service.start()
        if not start_success:
            return Response(
                {'success': False, 'message': 'Failed to start MQTT manager'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {'success': True, 'message': 'MQTT manager restarted successfully'},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Error in restart_manager API: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def force_discovery(request, site_id):
    """
    Forza refresh discovery per un sito - rilegge tutti i discovered topics
    e aggiorna datalogger/sensori.

    POST /v1/mqtt/sites/{site_id}/discover/
    """
    try:
        # Check superuser permission
        if not request.user.is_superuser:
            return Response(
                {'success': False, 'message': 'Superuser permission required'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(f"API request to force discovery refresh for site {site_id} by user {request.user}")

        from sites.models import Site
        from ..services.message_processor import message_processor
        import json

        # Verifica che il sito esista
        try:
            site = Site.objects.get(id=int(site_id))
        except Site.DoesNotExist:
            return Response(
                {'success': False, 'message': f'Site {site_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Recupera tutti i discovered topics per questo sito
        discovered_topics = DiscoveredTopic.objects.filter(site=site).order_by('-last_seen_at')

        if not discovered_topics.exists():
            return Response(
                {'success': True, 'message': 'No MQTT topics discovered yet. Make sure IoT devices are sending messages to the broker.', 'processed_count': 0, 'total_topics': 0},
                status=status.HTTP_200_OK
            )

        processed_count = 0
        success_count = 0
        error_count = 0

        # Re-processa tutti i topic scoperti
        for topic in discovered_topics:
            try:
                if topic.sample_payload:
                    # Converte il payload in bytes per simulare un messaggio MQTT
                    payload_str = json.dumps(topic.sample_payload)
                    payload_bytes = payload_str.encode('utf-8')

                    # Re-processa il messaggio
                    result = message_processor.process_message(
                        site_id=site.id,
                        topic=topic.topic_path,
                        payload=payload_bytes,
                        qos=0,
                        retain=False
                    )

                    if result:
                        success_count += 1
                    else:
                        error_count += 1

                    processed_count += 1

            except Exception as e:
                logger.error(f"Error reprocessing topic {topic.topic_path}: {e}")
                error_count += 1

        # Statistiche finali
        total_topics = discovered_topics.count()

        message = f"Discovery refresh completed: {success_count} successful, {error_count} errors, {total_topics} total topics"

        return Response({
            'success': True,
            'message': message,
            'processed_count': processed_count,
            'success_count': success_count,
            'error_count': error_count,
            'total_topics': total_topics
        }, status=status.HTTP_200_OK)

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in force_discovery API for site {site_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# DATALOGGER CONTROL APIs - per comandi start/stop
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_mqtt_message(request, site_id):
    """
    Pubblica un messaggio MQTT su un topic specifico.

    POST /v1/mqtt/sites/{site_id}/publish/
    Body: {
        "topic": "site_001/gateway/1/datalogger/monstro/1/input",
        "message": "start",
        "qos": 1
    }
    """
    try:
        site_id = int(site_id)

        # Validazione input
        topic = request.data.get('topic')
        message = request.data.get('message')
        qos = request.data.get('qos', 0)

        if not topic or not message:
            return Response(
                {'success': False, 'message': 'Topic and message are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verifica che l'utente abbia accesso al sito
        connection = MqttConnection.objects.filter(site_id=site_id).first()
        if not connection:
            return Response(
                {'success': False, 'message': f'No MQTT connection found for site {site_id}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Pubblica il messaggio tramite MQTT manager
        result = mqtt_service.publish_message(
            site_id=site_id,
            topic=topic,
            message=message,
            qos=qos
        )

        if result.get('success'):
            logger.info(f"MQTT message published by {request.user} to {topic}: {message}")
            return Response({
                'success': True,
                'message': f'Message published to {topic}',
                'topic': topic,
                'message_content': message
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'success': False, 'message': result.get('message', 'Failed to publish message')},
                status=status.HTTP_400_BAD_REQUEST
            )

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error publishing MQTT message for site {site_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_mqtt_topic(request, site_id):
    """
    Sottoscrivi a un topic MQTT per ricevere messaggi.

    POST /v1/mqtt/sites/{site_id}/subscribe/
    Body: {
        "topic": "site_001/gateway/1/datalogger/monstro/1/output",
        "callback_url": "/api/datalogger-control/123/mqtt-callback/"
    }
    """
    try:
        site_id = int(site_id)

        topic = request.data.get('topic')
        callback_url = request.data.get('callback_url')

        if not topic:
            return Response(
                {'success': False, 'message': 'Topic is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verifica connessione MQTT
        connection = MqttConnection.objects.filter(site_id=site_id).first()
        if not connection:
            return Response(
                {'success': False, 'message': f'No MQTT connection found for site {site_id}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Sottoscrivi tramite MQTT manager
        result = mqtt_service.subscribe_topic(
            site_id=site_id,
            topic=topic,
            callback_url=callback_url
        )

        if result.get('success'):
            logger.info(f"MQTT subscription created by {request.user} for topic {topic}")
            return Response({
                'success': True,
                'message': f'Subscribed to {topic}',
                'topic': topic
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'success': False, 'message': result.get('message', 'Failed to subscribe')},
                status=status.HTTP_400_BAD_REQUEST
            )

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid site_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error subscribing to MQTT topic for site {site_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def datalogger_mqtt_callback(request, datalogger_id):
    """
    Callback per ricevere messaggi MQTT dai topic di output dei datalogger.

    POST /api/datalogger-control/{datalogger_id}/mqtt-callback/
    Body: {
        "topic": "site_001/gateway/1/datalogger/monstro/1/output",
        "message": {"status": "running", "session_id": "..."}
    }
    """
    try:
        datalogger_id = int(datalogger_id)

        topic = request.data.get('topic')
        message = request.data.get('message')

        if not message:
            return Response(
                {'success': False, 'message': 'Message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verifica che il datalogger esista
        datalogger = Datalogger.objects.filter(id=datalogger_id).first()
        if not datalogger:
            return Response(
                {'success': False, 'message': f'Datalogger {datalogger_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Processa il messaggio per aggiornare lo stato del datalogger
        # Questo dovrebbe essere gestito dal frontend tramite WebSocket o polling
        # Per ora registriamo solo il messaggio
        logger.info(f"MQTT callback for datalogger {datalogger_id}: {message}")

        # TODO: Implementare notifica real-time al frontend
        # Opzioni: WebSocket, Server-Sent Events, o polling dal frontend

        return Response({
            'success': True,
            'message': 'Callback processed',
            'datalogger_id': datalogger_id
        }, status=status.HTTP_200_OK)

    except ValueError:
        return Response(
            {'success': False, 'message': 'Invalid datalogger_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error in datalogger MQTT callback {datalogger_id}: {e}")
        return Response(
            {'success': False, 'message': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def mqtt_service_health(request):
    """
    Health check endpoint per monitoring MQTT Service

    Returns:
        JSON con stato servizio e metriche connessioni
    """
    try:
        from ..services.mqtt_service import mqtt_service
        from django.conf import settings
        import subprocess

        # Check if mqtt_service supervisord program is running
        # (MQTT service runs in separate process, so we can't use mqtt_service.is_running())
        try:
            result = subprocess.run(
                ['supervisorctl', 'status', 'mqtt_service'],
                capture_output=True,
                text=True,
                timeout=5
            )
            is_running = 'RUNNING' in result.stdout
        except Exception as e:
            logger.warning(f"Could not check supervisord status: {e}")
            is_running = False

        # Query database directly since connections run in separate process
        from ..models import MqttConnection
        all_connections = MqttConnection.objects.all()

        total = all_connections.count()
        enabled = all_connections.filter(is_enabled=True).count()
        healthy = all_connections.filter(is_enabled=True, status='connected').count()

        # Build connections list for verbose mode
        connections = []
        if request.GET.get('verbose') == 'true':
            for conn in all_connections:
                connections.append({
                    'site_id': conn.site_id,
                    'site_name': conn.site.name,
                    'status': conn.status,
                    'is_enabled': conn.is_enabled,
                    'last_connected_at': conn.last_connected_at.isoformat() if conn.last_connected_at else None,
                    'error_message': conn.error_message if conn.error_message else None
                })

        # Determina health status globale
        if not is_running:
            health_status = 'critical'
        elif total == 0:
            health_status = 'warning'  # No connections configured
        elif healthy == enabled:
            health_status = 'healthy'
        elif healthy > 0:
            health_status = 'degraded'
        else:
            health_status = 'critical'

        return Response({
            'status': health_status,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'service': {
                'running': is_running,
                'instance_id': settings.MQTT_CONFIG.get('INSTANCE_ID', 'unknown')
            },
            'connections': {
                'total': total,
                'enabled': enabled,
                'healthy': healthy,
                'unhealthy': enabled - healthy
            },
            'details': connections if connections else None
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in mqtt_service_health: {e}", exc_info=True)
        return Response({
            'status': 'error',
            'message': f'Health check failed: {str(e)}',
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)