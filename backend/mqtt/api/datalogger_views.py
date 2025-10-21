"""
API Views per Datalogger e Sensor
"""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.decorators import user_passes_test

from ..models import Datalogger, Sensor
from .serializers import (
    DataloggerSerializer,
    SensorSerializer,
    DataloggerDetailSerializer,
    SensorDetailSerializer
)

logger = logging.getLogger(__name__)


def is_superuser(user):
    """Verifica che l'utente sia superuser."""
    return user.is_superuser


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dataloggers_list(request):
    """
    Lista tutti i datalogger auto-discovered.

    GET /v1/mqtt/dataloggers/
    Query params:
    - site_id: Filtra per sito specifico
    - online_only: true per mostrare solo datalogger online
    """
    try:
        queryset = Datalogger.objects.select_related('site').all()

        # Filtro per sito se specificato
        site_id = request.GET.get('site_id')
        if site_id:
            try:
                queryset = queryset.filter(site_id=int(site_id))
            except ValueError:
                return Response(
                    {'error': 'Invalid site_id parameter'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Filtro solo online se richiesto
        online_only = request.GET.get('online_only', '').lower() == 'true'
        if online_only:
            queryset = queryset.filter(is_online=True)

        # Ordina per sito e label
        queryset = queryset.order_by('site__name', 'label')

        serializer = DataloggerSerializer(queryset, many=True)

        return Response({
            'dataloggers': serializer.data,
            'total_count': len(serializer.data)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in dataloggers_list API: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def datalogger_detail(request, datalogger_id):
    """
    Dettaglio di un datalogger specifico con sensori.

    GET /v1/mqtt/dataloggers/{datalogger_id}/
    """
    try:
        datalogger = Datalogger.objects.select_related('site').prefetch_related('sensors').get(
            id=datalogger_id
        )

        serializer = DataloggerDetailSerializer(datalogger)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Datalogger.DoesNotExist:
        return Response(
            {'error': f'Datalogger {datalogger_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in datalogger_detail API for {datalogger_id}: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@user_passes_test(is_superuser)
def update_datalogger_label(request, datalogger_id):
    """
    Aggiorna label di un datalogger.

    PATCH /v1/mqtt/dataloggers/{datalogger_id}/update_label/
    Body: {"label": "new_label"}
    """
    try:
        datalogger = Datalogger.objects.get(id=datalogger_id)

        new_label = request.data.get('label', '').strip()
        if not new_label:
            return Response(
                {'error': 'Label is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        datalogger.label = new_label
        datalogger.save(update_fields=['label'])

        serializer = DataloggerSerializer(datalogger)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Datalogger.DoesNotExist:
        return Response(
            {'error': f'Datalogger {datalogger_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error updating datalogger label for {datalogger_id}: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sensors_by_datalogger(request):
    """
    Lista sensori per un datalogger specifico.

    GET /v1/mqtt/sensors/by_datalogger?datalogger_id=X
    """
    try:
        datalogger_id = request.GET.get('datalogger_id')
        if not datalogger_id:
            return Response(
                {'error': 'datalogger_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            datalogger = Datalogger.objects.select_related('site').get(id=int(datalogger_id))
        except (Datalogger.DoesNotExist, ValueError):
            return Response(
                {'error': f'Datalogger {datalogger_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        sensors = datalogger.sensors.all().order_by('label')
        sensor_serializer = SensorSerializer(sensors, many=True)
        datalogger_serializer = DataloggerSerializer(datalogger)

        return Response({
            'datalogger': datalogger_serializer.data,
            'sensors': sensor_serializer.data,
            'count': len(sensor_serializer.data)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in sensors_by_datalogger API: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sensor_detail(request, sensor_id):
    """
    Dettaglio di un sensore specifico.

    GET /v1/mqtt/sensors/{sensor_id}/
    """
    try:
        sensor = Sensor.objects.select_related('datalogger__site').get(id=sensor_id)

        serializer = SensorDetailSerializer(sensor)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Sensor.DoesNotExist:
        return Response(
            {'error': f'Sensor {sensor_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in sensor_detail API for {sensor_id}: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@user_passes_test(is_superuser)
def update_sensor_label(request, sensor_id):
    """
    Aggiorna label di un sensore.

    PATCH /v1/mqtt/sensors/{sensor_id}/update_label/
    Body: {"label": "new_label"}
    """
    try:
        sensor = Sensor.objects.get(id=sensor_id)

        new_label = request.data.get('label', '').strip()
        if not new_label:
            return Response(
                {'error': 'Label is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sensor.label = new_label
        sensor.save(update_fields=['label'])

        serializer = SensorSerializer(sensor)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Sensor.DoesNotExist:
        return Response(
            {'error': f'Sensor {sensor_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error updating sensor label for {sensor_id}: {e}")
        return Response(
            {'error': f'Internal error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )