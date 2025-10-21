"""
API Views per controllo MQTT
"""
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.decorators import user_passes_test

from ..services.mqtt_manager import mqtt_manager
from ..models import MqttConnection, Datalogger, Sensor
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


def is_superuser(user):
    """Verifica che l'utente sia superuser."""
    return user.is_superuser


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@user_passes_test(is_superuser)
def start_connection(request, site_id):
    """
    Avvia connessione MQTT per un sito specifico.

    POST /v1/mqtt/sites/{site_id}/start/
    """
    try:
        logger.info(f"API request to start MQTT connection for site {site_id} by user {request.user}")

        result = mqtt_manager.start_connection(site_id=int(site_id), manual=True)

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
@user_passes_test(is_superuser)
def stop_connection(request, site_id):
    """
    Ferma connessione MQTT per un sito specifico.

    POST /v1/mqtt/sites/{site_id}/stop/
    """
    try:
        logger.info(f"API request to stop MQTT connection for site {site_id} by user {request.user}")

        result = mqtt_manager.stop_connection(site_id=int(site_id))

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
@user_passes_test(is_superuser)
def connection_status(request, site_id):
    """
    Ottiene stato connessione MQTT per un sito specifico.

    GET /v1/mqtt/sites/{site_id}/status/
    """
    try:
        connection_status_data = mqtt_manager.get_connection_status(site_id=int(site_id))

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
@user_passes_test(is_superuser)
def manager_status(request):
    """
    Ottiene stato generale del manager MQTT.

    GET /v1/mqtt/manager/status/
    """
    try:
        all_connections = mqtt_manager.get_all_connections_status()

        # Calcola statistiche
        total_connections = len(all_connections)
        active_connections = len([c for c in all_connections if c.get('is_enabled', False)])
        connected_connections = len([c for c in all_connections if c.get('handler_connected', False)])
        error_connections = len([c for c in all_connections if c.get('status') == 'error'])

        status_data = {
            'is_running': mqtt_manager.is_running(),
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
@user_passes_test(is_superuser)
def all_connections_status(request):
    """
    Ottiene stato dettagliato di tutte le connessioni MQTT.

    GET /v1/mqtt/connections/status/
    """
    try:
        all_connections = mqtt_manager.get_all_connections_status()

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
@user_passes_test(is_superuser)
def connections_list(request):
    """
    Lista tutte le connessioni MQTT configurate nel DB.

    GET /v1/mqtt/connections/
    """
    try:
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
@user_passes_test(is_superuser)
def restart_manager(request):
    """
    Riavvia completamente il manager MQTT.

    POST /v1/mqtt/manager/restart/
    """
    try:
        logger.info(f"API request to restart MQTT manager by user {request.user}")

        # Ferma manager
        stop_success = mqtt_manager.stop()
        if not stop_success:
            return Response(
                {'success': False, 'message': 'Failed to stop MQTT manager'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Attendi un momento per cleanup
        import time
        time.sleep(2)

        # Riavvia manager
        start_success = mqtt_manager.start()
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