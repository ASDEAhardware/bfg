#!/usr/bin/env python3
"""
Test per verificare che il check all'avvio funzioni correttamente.

Scenario:
1. Crea un dispositivo ONLINE con last_seen recente
2. Crea un dispositivo ONLINE con last_seen vecchio (dovrebbe andare offline)
3. Simula riavvio eseguendo check_offline_devices()
4. Verifica che solo quello vecchio sia offline
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from mqtt.services.message_processor import message_processor
from mqtt.models import Gateway, Datalogger, Sensor
from sites.models import Site
from django.utils import timezone
from datetime import timedelta


def test_startup_check():
    print("=" * 80)
    print("TEST STARTUP CHECK - Verifica comportamento dopo riavvio")
    print("=" * 80)

    # Setup
    site = Site.objects.first()
    if not site:
        print("❌ Nessun sito trovato!")
        return False

    print(f"\n✅ Usando sito: {site.name}\n")

    # Cleanup
    print("🧹 Pulizia test precedenti...")
    Gateway.objects.filter(serial_number__startswith='startup_test_').delete()
    Datalogger.objects.filter(serial_number__startswith='startup_test_').delete()

    # Scenario 1: Crea dispositivi di test
    print("\n📝 SCENARIO 1: Creazione dispositivi test")
    print("-" * 80)

    now = timezone.now()

    # Gateway 1: ONLINE (ricevuto messaggio 5 secondi fa)
    gw1 = Gateway.objects.create(
        site=site,
        serial_number='startup_test_gw_online',
        label='Test Gateway Online',
        is_online=True,
        expected_heartbeat_interval=60,  # Timeout dopo 60 * 2.5 = 150s
        last_seen_at=now - timedelta(seconds=5)  # 5 secondi fa - DENTRO timeout
    )
    print(f"✅ Gateway ONLINE creato: {gw1.serial_number}")
    print(f"   - last_seen_at: 5 secondi fa")
    print(f"   - timeout: 150 secondi")
    print(f"   - Dovrebbe rimanere ONLINE ✓")

    # Gateway 2: DOVREBBE ANDARE OFFLINE (ricevuto messaggio 200 secondi fa)
    gw2 = Gateway.objects.create(
        site=site,
        serial_number='startup_test_gw_offline',
        label='Test Gateway Offline',
        is_online=True,  # MARCATO ONLINE MA È VECCHIO
        expected_heartbeat_interval=60,  # Timeout dopo 60 * 2.5 = 150s
        last_seen_at=now - timedelta(seconds=200)  # 200 secondi fa - OLTRE timeout
    )
    print(f"\n✅ Gateway STALE creato: {gw2.serial_number}")
    print(f"   - last_seen_at: 200 secondi fa")
    print(f"   - timeout: 150 secondi")
    print(f"   - Dovrebbe andare OFFLINE ✗")

    # Datalogger 1: ONLINE
    dl1 = Datalogger.objects.create(
        site=site,
        serial_number='startup_test_dl_online',
        label='Test Datalogger Online',
        is_online=True,
        expected_heartbeat_interval=10,  # Timeout dopo 25s
        last_seen_at=now - timedelta(seconds=3)  # 3 secondi fa - OK
    )
    print(f"\n✅ Datalogger ONLINE creato: {dl1.serial_number}")

    # Datalogger 2: DOVREBBE ANDARE OFFLINE
    dl2 = Datalogger.objects.create(
        site=site,
        serial_number='startup_test_dl_offline',
        label='Test Datalogger Offline',
        is_online=True,
        expected_heartbeat_interval=10,  # Timeout dopo 25s
        last_seen_at=now - timedelta(seconds=50)  # 50 secondi fa - OLTRE timeout
    )
    print(f"✅ Datalogger STALE creato: {dl2.serial_number}")

    # Scenario 2: Simula riavvio - esegui check
    print("\n\n📝 SCENARIO 2: Simula riavvio del servizio")
    print("-" * 80)
    print("⏱️  Eseguendo check_offline_devices() (come all'avvio)...\n")

    stats = message_processor.check_offline_devices()

    print(f"📊 Risultati check:")
    print(f"   Gateways controllati: {stats['gateways_checked']}")
    print(f"   Gateways marcati offline: {stats['gateways_offline']}")
    print(f"   Dataloggers controllati: {stats['dataloggers_checked']}")
    print(f"   Dataloggers marcati offline: {stats['dataloggers_offline']}")

    # Scenario 3: Verifica risultati
    print("\n\n📝 SCENARIO 3: Verifica stato finale")
    print("-" * 80)

    gw1.refresh_from_db()
    gw2.refresh_from_db()
    dl1.refresh_from_db()
    dl2.refresh_from_db()

    success = True

    # Check Gateway 1 (dovrebbe rimanere online)
    if gw1.is_online:
        print(f"✅ {gw1.serial_number}: ONLINE (corretto)")
    else:
        print(f"❌ {gw1.serial_number}: OFFLINE (ERRORE - doveva rimanere online!)")
        success = False

    # Check Gateway 2 (dovrebbe andare offline)
    if not gw2.is_online:
        print(f"✅ {gw2.serial_number}: OFFLINE (corretto)")
    else:
        print(f"❌ {gw2.serial_number}: ONLINE (ERRORE - doveva andare offline!)")
        success = False

    # Check Datalogger 1
    if dl1.is_online:
        print(f"✅ {dl1.serial_number}: ONLINE (corretto)")
    else:
        print(f"❌ {dl1.serial_number}: OFFLINE (ERRORE - doveva rimanere online!)")
        success = False

    # Check Datalogger 2
    if not dl2.is_online:
        print(f"✅ {dl2.serial_number}: OFFLINE (corretto)")
    else:
        print(f"❌ {dl2.serial_number}: ONLINE (ERRORE - doveva andare offline!)")
        success = False

    # Cleanup
    print("\n🧹 Pulizia dispositivi test...")
    Gateway.objects.filter(serial_number__startswith='startup_test_').delete()
    Datalogger.objects.filter(serial_number__startswith='startup_test_').delete()
    print("✅ Cleanup completato")

    # Risultato finale
    print("\n" + "=" * 80)
    if success:
        print("🎉 TEST SUPERATO! Il check all'avvio funziona correttamente!")
        print("=" * 80)
        return True
    else:
        print("❌ TEST FALLITO! Ci sono errori nel check all'avvio")
        print("=" * 80)
        return False


if __name__ == "__main__":
    success = test_startup_check()
    sys.exit(0 if success else 1)
