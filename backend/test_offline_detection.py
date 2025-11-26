#!/usr/bin/env python3
"""
Script di test per verificare la detection offline/online dei dispositivi.
Testa il metodo check_offline_devices() e la gestione del message_interval_seconds.
"""
import os
import sys
import django
import json
from datetime import datetime, timedelta
import time

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from mqtt.services.message_processor import message_processor
from mqtt.models import Gateway, Datalogger, Sensor
from sites.models import Site
from django.utils import timezone

# Payload di test con message_interval_seconds = 5
TEST_PAYLOAD = {
    "serial_number_gateway": "test-gateway-001",
    "timestamp": "2025-11-25T15:32:24.661225Z",
    "message_interval_seconds": 5,  # Timeout dopo 5 * 2.5 = 12.5 secondi
    "mqtt_api_version": "1.0.0",
    "dataloggers": [
        {
            "serial_number_datalogger": "test_datalogger",
            "status_datalogger": "running",
            "devices": [
                {
                    "type": "monstr-o",
                    "serial_number_device": "TEST_MNA001",
                    "data": [
                        {"type": "accelerometer", "value": [1.0, 2.0, 3.0]},
                        {"type": "inclinometer", "value": [0.5, 1.5, 2.5]}
                    ]
                }
            ]
        }
    ]
}

TEST_TOPIC = "test_site/gateway/1/dataloggers/telemetry"


def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_device_status(gateway, datalogger, sensors):
    """Stampa lo stato attuale dei dispositivi."""
    now = timezone.now()

    print(f"\n📊 STATO DISPOSITIVI:")
    print(f"   Gateway: {gateway.serial_number}")
    print(f"     - Online: {gateway.is_online}")
    print(f"     - Expected interval: {gateway.expected_heartbeat_interval}s")
    print(f"     - Timeout threshold: {gateway.expected_heartbeat_interval * 2.5}s")
    if gateway.last_seen_at:
        elapsed = (now - gateway.last_seen_at).total_seconds()
        print(f"     - Last seen: {elapsed:.1f}s ago")

    print(f"\n   Datalogger: {datalogger.serial_number}")
    print(f"     - Online: {datalogger.is_online}")
    print(f"     - Expected interval: {datalogger.expected_heartbeat_interval}s")
    if datalogger.last_seen_at:
        elapsed = (now - datalogger.last_seen_at).total_seconds()
        print(f"     - Last seen: {elapsed:.1f}s ago")

    print(f"\n   Sensori ({len(sensors)}):")
    for sensor in sensors:
        if sensor.last_seen_at:
            elapsed = (now - sensor.last_seen_at).total_seconds()
            print(f"     - {sensor.serial_number}: Online={sensor.is_online}, Last seen={elapsed:.1f}s ago")


def test_offline_detection():
    """Test principale della detection offline."""

    print_section("TEST OFFLINE DETECTION - MQTT Message Processor")

    # 1. Setup: Verifica esistenza sito
    print("🔍 Setup test environment...")
    site = Site.objects.first()
    if not site:
        print("❌ ERRORE: Nessun sito trovato!")
        return False

    print(f"✅ Sito: {site.name} (ID: {site.id})")
    site_id = site.id

    # 2. Pulisci test precedenti
    print("\n🧹 Pulizia dispositivi di test precedenti...")
    Gateway.objects.filter(serial_number="test-gateway-001").delete()
    Datalogger.objects.filter(serial_number="TEST_MNA001").delete()
    print("✅ Pulizia completata")

    # 3. Invia primo messaggio per creare dispositivi
    print_section("FASE 1: Creazione Dispositivi")
    print("📤 Invio primo messaggio MQTT...")

    payload_bytes = json.dumps(TEST_PAYLOAD).encode('utf-8')
    result = message_processor.process_message(
        site_id=site_id,
        topic=TEST_TOPIC,
        payload=payload_bytes,
        qos=1,
        retain=False
    )

    if not result:
        print("❌ Processamento fallito!")
        return False

    print("✅ Messaggio processato")

    # Recupera i dispositivi creati
    gateway = Gateway.objects.get(serial_number="test-gateway-001")
    datalogger = Datalogger.objects.get(serial_number="TEST_MNA001")
    sensors = list(Sensor.objects.filter(datalogger=datalogger))

    print(f"\n✅ Dispositivi creati:")
    print(f"   - Gateway: {gateway.serial_number}")
    print(f"   - Datalogger: {datalogger.serial_number}")
    print(f"   - Sensori: {len(sensors)}")

    print_device_status(gateway, datalogger, sensors)

    # 4. Test: Device rimane ONLINE se riceve messaggi
    print_section("FASE 2: Test Keep-Alive (Device rimane ONLINE)")
    print("⏱️  Invio messaggi ogni 3 secondi per 10 secondi...")
    print("   (Timeout configurato: 12.5s = 5s * 2.5)")

    for i in range(4):  # 4 messaggi in 10 secondi (ogni 3s)
        time.sleep(3)

        # Aggiorna timestamp nel payload
        TEST_PAYLOAD['timestamp'] = timezone.now().isoformat()
        payload_bytes = json.dumps(TEST_PAYLOAD).encode('utf-8')

        message_processor.process_message(
            site_id=site_id,
            topic=TEST_TOPIC,
            payload=payload_bytes,
            qos=1,
            retain=False
        )

        # Esegui check offline
        stats = message_processor.check_offline_devices()

        # Ricarica oggetti dal DB
        gateway.refresh_from_db()
        datalogger.refresh_from_db()
        for sensor in sensors:
            sensor.refresh_from_db()

        print(f"\n   ⏱️  Tick {i+1}/4:")
        print(f"      Gateway online: {gateway.is_online}")
        print(f"      Datalogger online: {datalogger.is_online}")
        print(f"      Sensors online: {all(s.is_online for s in sensors)}")

        if not (gateway.is_online and datalogger.is_online and all(s.is_online for s in sensors)):
            print("      ❌ ERRORE: Dispositivi sono andati offline mentre ricevevano messaggi!")
            return False

    print("\n✅ Test Keep-Alive SUPERATO: I dispositivi rimangono online")

    # 5. Test: Device va OFFLINE dopo timeout
    print_section("FASE 3: Test Timeout (Device va OFFLINE)")
    print("⏱️  STOP messaggi MQTT...")
    print("   Attendo 15 secondi (oltre il timeout di 12.5s)...")

    # Aspetta 15 secondi senza inviare messaggi
    for i in range(15):
        time.sleep(1)

        # Esegui check offline ogni secondo
        stats = message_processor.check_offline_devices()

        # Ricarica oggetti dal DB
        gateway.refresh_from_db()
        datalogger.refresh_from_db()
        for sensor in sensors:
            sensor.refresh_from_db()

        # Verifica se sono andati offline
        if not gateway.is_online or not datalogger.is_online or not all(s.is_online for s in sensors):
            print(f"\n   ⏱️  Dopo {i+1} secondi:")
            print(f"      Gateway offline: {not gateway.is_online}")
            print(f"      Datalogger offline: {not datalogger.is_online}")
            print(f"      Sensors offline: {sum(1 for s in sensors if not s.is_online)}/{len(sensors)}")
            print(f"\n✅ Dispositivi marcati OFFLINE correttamente!")
            break
    else:
        print("\n❌ ERRORE: Dispositivi non sono andati offline dopo il timeout!")
        return False

    print_device_status(gateway, datalogger, sensors)

    # 6. Test: Device torna ONLINE quando riceve nuovi messaggi
    print_section("FASE 4: Test Recovery (Device torna ONLINE)")
    print("📤 Invio nuovo messaggio MQTT...")

    TEST_PAYLOAD['timestamp'] = timezone.now().isoformat()
    payload_bytes = json.dumps(TEST_PAYLOAD).encode('utf-8')

    message_processor.process_message(
        site_id=site_id,
        topic=TEST_TOPIC,
        payload=payload_bytes,
        qos=1,
        retain=False
    )

    # Ricarica oggetti dal DB
    gateway.refresh_from_db()
    datalogger.refresh_from_db()
    for sensor in sensors:
        sensor.refresh_from_db()

    print(f"\n   Gateway online: {gateway.is_online}")
    print(f"   Datalogger online: {datalogger.is_online}")
    print(f"   Sensors online: {all(s.is_online for s in sensors)}")

    if gateway.is_online and datalogger.is_online and all(s.is_online for s in sensors):
        print("\n✅ Test Recovery SUPERATO: Dispositivi tornati online!")
    else:
        print("\n❌ ERRORE: Dispositivi non sono tornati online!")
        return False

    print_device_status(gateway, datalogger, sensors)

    # 7. Cleanup
    print_section("CLEANUP")
    print("🧹 Rimozione dispositivi di test...")
    Gateway.objects.filter(serial_number="test-gateway-001").delete()
    print("✅ Cleanup completato")

    # 8. Riepilogo
    print_section("RIEPILOGO TEST")
    print("✅ Test 1: Keep-Alive - SUPERATO")
    print("✅ Test 2: Timeout Detection - SUPERATO")
    print("✅ Test 3: Recovery - SUPERATO")
    print("\n🎉 TUTTI I TEST SUPERATI! 🎉")

    return True


if __name__ == "__main__":
    print("Avvio test offline detection...\n")

    success = test_offline_detection()

    if success:
        print("\n✅ Test completato con successo!")
        sys.exit(0)
    else:
        print("\n❌ Test fallito!")
        sys.exit(1)
