#!/usr/bin/env python3
"""
Script di test per validare il parsing del nuovo topic telemetry.
Simula l'invio di un messaggio MQTT e verifica che venga parsato correttamente.
"""
import os
import sys
import django
import json
from datetime import datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from mqtt.services.message_processor import message_processor
from mqtt.models import Gateway, Datalogger, Sensor
from sites.models import Site

# Payload di test (quello fornito dall'utente)
TEST_PAYLOAD = {
    "serial_number_gateway": "site_001-gateway_1",
    "timestamp": "2025-11-25T15:32:24.661225Z",
    "message_interval_seconds": 5,
    "mqtt_api_version": "1.0.0",
    "dataloggers": [
        {
            "serial_number_datalogger": "bfg_datalogger_all",
            "status_datalogger": "running",
            "devices": [
                {
                    "type": "monstr-o",
                    "serial_number_device": "MNA000123",
                    "data": [
                        {
                            "type": "accelerometer",
                            "value": [1.342, 3.456, 4.567]
                        },
                        {
                            "type": "inclinometer",
                            "value": [1.342, 3.456, 4.567]
                        }
                    ]
                },
                {
                    "type": "monstr-o",
                    "serial_number_device": "MNA000124",
                    "data": [
                        {
                            "type": "accelerometer",
                            "value": [1.342, 3.456, 4.567]
                        },
                        {
                            "type": "inclinometer",
                            "value": [1.342, 3.645]
                        }
                    ]
                },
                {
                    "type": "adaq",
                    "serial_number_device": "MAS8AT00",
                    "data": [
                        {
                            "type": "ch1",
                            "value": [1.342]
                        },
                        {
                            "type": "ch2",
                            "value": [3.645]
                        }
                    ]
                }
            ]
        }
    ]
}

TEST_TOPIC = "site_001/gateway/1/dataloggers/telemetry"


def print_section(title):
    """Stampa una sezione con separatore."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def test_telemetry_parsing():
    """Test principale del parsing telemetry."""

    print_section("TEST PARSING TELEMETRY - MQTT Message Processor")

    # 1. Verifica esistenza sito
    print("🔍 Verifico esistenza sito...")
    try:
        site = Site.objects.first()
        if not site:
            print("❌ ERRORE: Nessun sito trovato nel database!")
            print("   Crea prima un sito tramite admin Django.")
            return False

        print(f"✅ Sito trovato: {site.name} (ID: {site.id})")
        site_id = site.id

    except Exception as e:
        print(f"❌ Errore recupero sito: {e}")
        return False

    # 2. Test parsing del topic
    print("\n🧪 Test 1: Parsing struttura topic...")
    topic_info = message_processor._parse_topic_structure(TEST_TOPIC)

    if topic_info['type'] == 'dataloggers_telemetry':
        print(f"✅ Topic parsato correttamente:")
        print(f"   Type: {topic_info['type']}")
        print(f"   Site Code: {topic_info['site_code']}")
        print(f"   Gateway Number: {topic_info['gateway_number']}")
    else:
        print(f"❌ ERRORE: Topic non riconosciuto! Tipo: {topic_info['type']}")
        return False

    # 3. Test processamento messaggio
    print("\n🧪 Test 2: Processamento messaggio completo...")

    # Converti payload in bytes (come arriva da MQTT)
    payload_bytes = json.dumps(TEST_PAYLOAD).encode('utf-8')

    try:
        result = message_processor.process_message(
            site_id=site_id,
            topic=TEST_TOPIC,
            payload=payload_bytes,
            qos=1,
            retain=False
        )

        if result:
            print("✅ Messaggio processato con successo!")
        else:
            print("❌ Processamento fallito (restituito False)")
            return False

    except Exception as e:
        print(f"❌ Eccezione durante processamento: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 4. Verifica dati salvati
    print("\n🔍 Verifico dati salvati nel database...")

    # 4.1 Gateway
    print("\n📡 GATEWAY:")
    gateway = Gateway.objects.filter(serial_number="site_001-gateway_1").first()
    if gateway:
        print(f"✅ Gateway trovato: {gateway.serial_number}")
        print(f"   ID: {gateway.id}")
        print(f"   Label: {gateway.label}")
        print(f"   Online: {gateway.is_online}")
        print(f"   Site: {gateway.site.name}")
    else:
        print("❌ Gateway NON trovato!")
        return False

    # 4.2 Dataloggers (devices)
    print("\n💾 DATALOGGERS (Devices):")
    expected_devices = ["MNA000123", "MNA000124", "MAS8AT00"]

    for device_serial in expected_devices:
        datalogger = Datalogger.objects.filter(serial_number=device_serial).first()
        if datalogger:
            print(f"✅ Datalogger {device_serial}:")
            print(f"   ID: {datalogger.id}")
            print(f"   Type: {datalogger.datalogger_type}")
            print(f"   Online: {datalogger.is_online}")
            print(f"   Status: {datalogger.acquisition_status}")
            print(f"   Sensori: {datalogger.sensors.count()}")
        else:
            print(f"❌ Datalogger {device_serial} NON trovato!")
            return False

    # 4.3 Sensori
    print("\n🌡️  SENSORI:")
    expected_sensors = [
        "MNA000123-accelerometer",
        "MNA000123-inclinometer",
        "MNA000124-accelerometer",
        "MNA000124-inclinometer",
        "MAS8AT00-ch1",
        "MAS8AT00-ch2",
    ]

    for sensor_serial in expected_sensors:
        sensor = Sensor.objects.filter(serial_number=sensor_serial).first()
        if sensor:
            print(f"✅ Sensor {sensor_serial}:")
            print(f"   ID: {sensor.id}")
            print(f"   Type: {sensor.sensor_type}")
            print(f"   Online: {sensor.is_online}")
            print(f"   Last data: {sensor.last_data_1}")
            print(f"   Total readings: {sensor.total_readings}")
        else:
            print(f"❌ Sensor {sensor_serial} NON trovato!")
            return False

    # 5. Test valori formattati
    print("\n📊 VERIFICA VALORI FORMATTATI:")

    # Accelerometro (dovrebbe avere x, y, z)
    acc_sensor = Sensor.objects.filter(serial_number="MNA000123-accelerometer").first()
    if acc_sensor and acc_sensor.last_data_1:
        data = acc_sensor.last_data_1
        if 'x' in data and 'y' in data and 'z' in data:
            print(f"✅ Accelerometro formattato correttamente:")
            print(f"   x={data['x']}, y={data['y']}, z={data['z']}")
        else:
            print(f"⚠️  Accelerometro formato inatteso: {data}")

    # Canale ADAQ (dovrebbe avere 'value')
    ch_sensor = Sensor.objects.filter(serial_number="MAS8AT00-ch1").first()
    if ch_sensor and ch_sensor.last_data_1:
        data = ch_sensor.last_data_1
        if 'value' in data:
            print(f"✅ Canale ADAQ formattato correttamente:")
            print(f"   value={data['value']}")
        else:
            print(f"⚠️  Canale ADAQ formato inatteso: {data}")

    # 6. Riepilogo
    print_section("RIEPILOGO TEST")

    total_dataloggers = Datalogger.objects.filter(gateway=gateway).count()
    total_sensors = Sensor.objects.filter(datalogger__gateway=gateway).count()

    print(f"✅ Test completato con successo!")
    print(f"   Gateway creati: 1")
    print(f"   Dataloggers creati: {total_dataloggers} (attesi: 3)")
    print(f"   Sensori creati: {total_sensors} (attesi: 6)")

    if total_dataloggers == 3 and total_sensors == 6:
        print("\n🎉 TUTTI I TEST SUPERATI! 🎉")
        return True
    else:
        print("\n⚠️  Alcuni conteggi non corrispondono agli attesi.")
        return False


if __name__ == "__main__":
    print("Avvio test parsing telemetry...\n")

    success = test_telemetry_parsing()

    if success:
        print("\n✅ Test terminato con successo!")
        sys.exit(0)
    else:
        print("\n❌ Test fallito!")
        sys.exit(1)
