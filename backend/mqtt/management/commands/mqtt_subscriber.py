# mqtt/management/commands/mqtt_subscriber.py

import os
import json
import ssl
import paho.mqtt.client as mqtt
from django.core.management.base import BaseCommand
from django.conf import settings
from mqtt.models import Device, DataloggerStatus

def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print("✅ MQTT Subscriber: Connected successfully")
        client.subscribe(settings.MQTT_OUTPUT_TOPIC)
        print(f"📡 MQTT Subscriber: Subscribed to {settings.MQTT_OUTPUT_TOPIC}")
    else:
        print(f"❌ MQTT Subscriber: Connection failed, code: {reason_code}")


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    if reason_code != 0:
        print(f"🔌 MQTT Subscriber: Unexpected disconnection, code: {reason_code}")
    else:
        print("🔌 MQTT Subscriber: Disconnected cleanly")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode()
        print(f"[{msg.topic}] {payload_str}")

        try:
            data = json.loads(payload_str)
            
            # Handling device information
            if 'serial_number' in data and 'ip_address' in data:
                Device.objects.update_or_create(
                    serial_number=data['serial_number'],
                    defaults={
                        'ip_address': data['ip_address'],
                        'software_version': data.get('software_version', 'N/A')
                    }
                )
                print(f"Updated device: {data['serial_number']}")

            # Status processing
            elif 'status' in data:
                status_obj, created = DataloggerStatus.objects.get_or_create(pk=1)
                status_obj.status = data['status']
                status_obj.details = payload_str
                status_obj.save()
                print(f"Updated datalogger status: {data['status']}")

        except json.JSONDecodeError:
            # If it's not JSON, it might be a string log
            print(f"Received non-JSON message: {payload_str}")
            # You can add logic here to save such logs if needed

    except Exception as e:
        print(f"Error processing message: {e}")


class Command(BaseCommand):
    help = 'Starts the MQTT subscriber to listen for datalogger responses.'

    def handle(self, *args, **options):
        client = mqtt.Client(
            client_id=settings.MQTT_OUTPUT_CLIENT_ID,
            protocol=mqtt.MQTTv311,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        
        # TLS
        client.tls_set(ca_certs=None, cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
        # client.tls_insecure_set(True) # Uncomment for debugging if needed

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message

        # Add unique timestamp to client ID to prevent conflicts
        import time
        unique_client_id = f"{settings.MQTT_OUTPUT_CLIENT_ID}_{int(time.time())}"
        client._client_id = unique_client_id.encode('utf-8')

        self.stdout.write("Starting MQTT subscriber...")
        try:
            client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            client.loop_forever()
        except KeyboardInterrupt:
            print("\n🛑 MQTT Subscriber: Stopping...")
            client.disconnect()
        except Exception as e:
            print(f"❌ MQTT Subscriber: Fatal error: {e}")
            client.disconnect()
