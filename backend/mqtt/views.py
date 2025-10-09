# mqtt/views.py

import paho.mqtt.client as mqtt
import ssl
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from .models import Device, DataloggerStatus, SubscriberStatus
from django.views.decorators.cache import never_cache

@csrf_exempt
@require_http_methods(["POST"])
def send_mqtt_command(request):
    """
    Accepts a POST request with a command and sends it to MQTT.
    Example request body: {"command": "start"}
    """
    try:
        data = json.loads(request.body)
        command = data.get('command')

        if command not in ['start', 'stop', 'status', 'start --detect']:
            return JsonResponse({'status': 'error', 'message': 'Invalid command'}, status=400)

        client = mqtt.Client(
            client_id=settings.MQTT_CONTROL_CLIENT_ID,
            protocol=mqtt.MQTTv311,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        client.tls_set(ca_certs=None, cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
        # client.tls_insecure_set(True)

        client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
        client.loop_start()
        
        result = client.publish(settings.MQTT_CONTROL_TOPIC, command, qos=1)
        result.wait_for_publish() # Wait for send confirmation
        
        client.loop_stop()
        client.disconnect()

        return JsonResponse({'status': 'success', 'message': f'Command "{command}" sent.'})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@csrf_exempt
@never_cache
@require_http_methods(["GET"])
def get_datalogger_status(request):
    """
    Returns the current datalogger status.
    """
    try:
        status_obj = DataloggerStatus.objects.filter(pk=1).first()
        if status_obj:
            return JsonResponse({
                'status': 'success',
                'data': {
                    'status': status_obj.status,
                    'details': status_obj.details,
                    'timestamp': status_obj.timestamp.isoformat()
                }
            })
        else:
            return JsonResponse({
                'status': 'success',
                'data': {
                    'status': 'unknown',
                    'details': 'No status information available',
                    'timestamp': None
                }
            })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_discovered_devices(request):
    """
    Returns all discovered devices.
    """
    try:
        devices = Device.objects.all()
        devices_data = []
        for device in devices:
            devices_data.append({
                'serial_number': device.serial_number,
                'ip_address': device.ip_address,
                'software_version': device.software_version,
                'last_seen': device.last_seen.isoformat()
            })

        return JsonResponse({
            'status': 'success',
            'data': devices_data
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def start_subscriber(request):
    """
    Starts the MQTT subscriber process.
    """
    try:
        import subprocess
        import os

        # Check if subscriber is already running
        subscriber_status, created = SubscriberStatus.objects.get_or_create(pk=1)

        if subscriber_status.status == 'connected':
            return JsonResponse({'status': 'warning', 'message': 'Subscriber is already running'})

        # Start the subscriber process
        subscriber_status.status = 'connecting'
        subscriber_status.error_message = None
        subscriber_status.save()

        # Start the management command in background
        process = subprocess.Popen([
            'python', 'manage.py', 'mqtt_subscriber'
        ], cwd='/app', stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        subscriber_status.process_id = process.pid
        subscriber_status.status = 'connected'
        subscriber_status.save()

        return JsonResponse({
            'status': 'success',
            'message': 'MQTT subscriber started successfully',
            'process_id': process.pid
        })

    except Exception as e:
        if 'subscriber_status' in locals():
            subscriber_status.status = 'error'
            subscriber_status.error_message = str(e)
            subscriber_status.save()
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def stop_subscriber(request):
    """
    Stops the MQTT subscriber process.
    """
    try:
        import signal

        subscriber_status = SubscriberStatus.objects.filter(pk=1).first()

        if not subscriber_status or subscriber_status.status == 'disconnected':
            return JsonResponse({'status': 'warning', 'message': 'Subscriber is not running'})

        # Try to stop the process if we have a PID
        if subscriber_status.process_id:
            try:
                os.kill(subscriber_status.process_id, signal.SIGTERM)
            except ProcessLookupError:
                pass  # Process already stopped

        subscriber_status.status = 'disconnected'
        subscriber_status.process_id = None
        subscriber_status.error_message = None
        subscriber_status.save()

        return JsonResponse({
            'status': 'success',
            'message': 'MQTT subscriber stopped successfully'
        })

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@require_http_methods(["GET"])
def get_subscriber_status(request):
    """
    Returns the current MQTT subscriber status.
    """
    try:
        subscriber_status = SubscriberStatus.objects.filter(pk=1).first()

        if not subscriber_status:
            return JsonResponse({
                'status': 'success',
                'data': {
                    'status': 'disconnected',
                    'last_heartbeat': None,
                    'error_message': None,
                    'process_id': None
                }
            })

        return JsonResponse({
            'status': 'success',
            'data': {
                'status': subscriber_status.status,
                'last_heartbeat': subscriber_status.last_heartbeat.isoformat(),
                'error_message': subscriber_status.error_message,
                'process_id': subscriber_status.process_id
            }
        })

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
