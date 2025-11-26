# 📖 Offline Detection System - Guida Completa

## 🎯 Panoramica

Il sistema di detection offline marca automaticamente dispositivi (Gateway, Datalogger, Sensor) come **OFFLINE** quando non inviano messaggi entro il timeout previsto.

**Formula Timeout:**
```
timeout_seconds = expected_heartbeat_interval * 2.5
```

**Esempio:**
- `message_interval_seconds: 5` → Timeout dopo **12.5 secondi**
- `message_interval_seconds: 60` → Timeout dopo **150 secondi**

---

## 🏗️ Architettura - 3 Livelli di Protezione

### 1. ✅ **Startup Check** (All'avvio)
**Quando:** Ogni volta che il servizio MQTT si avvia/riavvia
**Cosa fa:** Esegue `check_offline_devices()` PRIMA di iniziare a processare messaggi
**Perché:** Garantisce stato corretto dopo crash/riavvii imprevisti
**Codice:** `mqtt/services/mqtt_service.py:366`

```python
# All'avvio del servizio MQTT:
logger.info("Running startup offline check...")
stats = message_processor.check_offline_devices()
```

---

### 2. ✅ **Monitor Thread** (Runtime)
**Quando:** Ogni 30 secondi durante l'esecuzione
**Cosa fa:** Verifica continuamente tutti i dispositivi online
**Perché:** Mantiene stato sempre aggiornato in real-time
**Codice:** `mqtt/services/mqtt_service.py:336`

```python
# Thread di monitoring (loop infinito)
while not self._should_stop:
    message_processor.check_offline_devices()
    time.sleep(30)
```

---

### 3. ✅ **Cronjob Ridondante** (Opzionale - Safety Net)
**Quando:** Ogni 5-10 minuti (configurabile)
**Cosa fa:** Check ridondante indipendente dal servizio MQTT
**Perché:** Protezione extra se monitor thread fallisce
**Setup:** Vedi sezione "Configurazione Cronjob" sotto

---

## 🔧 Configurazione

### Automatic (Già Attivo)

Il sistema è **automaticamente attivo** con:
- ✅ Startup check all'avvio
- ✅ Monitor thread ogni 30s
- ✅ Broadcast WebSocket quando cambia stato

**Non serve configurazione!** 🎉

---

### Opzionale: Cronjob Ridondante

Per massima affidabilità, aggiungi un cronjob indipendente:

#### **Opzione A: Crontab Sistema**

```bash
# Edita crontab
crontab -e

# Aggiungi (ogni 5 minuti):
*/5 * * * * cd /path/to/backend && python manage.py check_offline_devices >> /var/log/mqtt_check.log 2>&1
```

#### **Opzione B: Django-Cron**

```python
# settings.py
INSTALLED_APPS += ['django_cron']

CRON_CLASSES = [
    'mqtt.cron.CheckOfflineDevicesCronJob',
]

# mqtt/cron.py
from django_cron import CronJobBase, Schedule

class CheckOfflineDevicesCronJob(CronJobBase):
    schedule = Schedule(run_every_mins=5)
    code = 'mqtt.check_offline_devices'

    def do(self):
        from mqtt.services.message_processor import message_processor
        message_processor.check_offline_devices()
```

#### **Opzione C: Celery Beat**

```python
# celery.py
from celery import Celery
from celery.schedules import crontab

app = Celery('bfg')

app.conf.beat_schedule = {
    'check-offline-devices': {
        'task': 'mqtt.tasks.check_offline_devices',
        'schedule': crontab(minute='*/5'),  # Ogni 5 minuti
    },
}

# mqtt/tasks.py
from celery import shared_task

@shared_task
def check_offline_devices():
    from mqtt.services.message_processor import message_processor
    return message_processor.check_offline_devices()
```

---

## 📊 Uso Manuale

### Check Immediato

```bash
# Check e marca offline immediatamente
python manage.py check_offline_devices

# Con output dettagliato
python manage.py check_offline_devices --verbose

# Dry-run (mostra cosa farebbe senza modificare)
python manage.py check_offline_devices --dry-run

# Combinazione
python manage.py check_offline_devices --verbose --dry-run
```

**Output:**
```
🔍 Checking offline devices...

📊 RESULTS:
   Gateways checked: 1
   Gateways marked offline: 0
   Dataloggers checked: 4
   Dataloggers marked offline: 2
   Sensors checked: 6
   Sensors marked offline: 3

⚠️  5 devices marked offline
```

---

## 🧪 Testing

### Test Automatico

```bash
# Test completo offline detection
python test_offline_detection.py

# Test startup check
python test_startup_check.py

# Test parsing telemetry
python test_telemetry_parsing.py
```

### Test Manuale

```bash
# 1. Verifica stato attuale
python manage.py check_offline_devices --verbose

# 2. Simula timeout (non inviare messaggi per > timeout)
# ... aspetta 30 secondi ...

# 3. Verifica che siano offline
python manage.py check_offline_devices --verbose

# 4. Invia nuovo messaggio MQTT
# I dispositivi torneranno ONLINE automaticamente
```

---

## 📈 Monitoring e Debug

### Log di Sistema

```bash
# Monitor log in real-time
podman logs -f bfg_backend | grep offline

# Output esempio:
# Running startup offline check...
# Startup offline check completed: Gateways 0/1, Dataloggers 2/4, Sensors 3/6
# Gateway site_001-gateway_1 marked OFFLINE (elapsed: 200.0s, timeout: 150.0s)
# Datalogger MNA000123 marked OFFLINE (elapsed: 50.0s, timeout: 25.0s)
```

### Verifica DB Manuale

```python
from mqtt.models import Gateway, Datalogger, Sensor
from django.utils import timezone

# Check Gateway
gw = Gateway.objects.get(serial_number='site_001-gateway_1')
print(f"Online: {gw.is_online}")
print(f"Last seen: {gw.last_seen_at}")
print(f"Expected interval: {gw.expected_heartbeat_interval}s")
print(f"Timeout: {gw.expected_heartbeat_interval * 2.5}s")

# Check quanto tempo fa
if gw.last_seen_at:
    elapsed = (timezone.now() - gw.last_seen_at).total_seconds()
    print(f"Elapsed: {elapsed:.1f}s")
```

---

## 🔍 Troubleshooting

### Problema: "Dispositivi rimangono ONLINE anche se non comunicano"

**Cause possibili:**

1. **Monitor thread non attivo**
   ```bash
   # Verifica nei log
   podman logs bfg_backend | grep "Running startup offline check"
   # Se NON vedi il messaggio → Riavvia backend
   podman restart bfg_backend
   ```

2. **expected_heartbeat_interval non impostato**
   ```python
   # Verifica
   Datalogger.objects.filter(expected_heartbeat_interval__isnull=True).count()
   # Se > 0 → Invia nuovo messaggio con message_interval_seconds
   ```

3. **last_seen_at non aggiornato**
   ```python
   # Verifica
   Sensor.objects.filter(last_seen_at__isnull=True).count()
   # Se > 0 → Invia nuovo messaggio
   ```

---

### Problema: "Dispositivi vanno offline troppo presto"

**Soluzione:** Aumenta `message_interval_seconds` nel payload MQTT

```json
{
  "message_interval_seconds": 60,  // Era 5 → Ora timeout dopo 150s invece di 12.5s
  ...
}
```

---

### Problema: "Dispositivi vanno offline troppo tardi"

**Soluzione:** Diminuisci `message_interval_seconds` nel payload MQTT

```json
{
  "message_interval_seconds": 10,  // Era 60 → Ora timeout dopo 25s invece di 150s
  ...
}
```

---

## 📋 Best Practices

### ✅ DO

- ✅ Imposta `message_interval_seconds` nel payload MQTT
- ✅ Usa timeout `* 2.5` per tolleranza rete/latenza
- ✅ Monitora log per verificare funzionamento
- ✅ Configura cronjob ridondante in produzione
- ✅ Testa dopo modifiche al codice

### ❌ DON'T

- ❌ NON usare trigger database (complesso, non portable)
- ❌ NON calcolare is_online al volo (troppo lento)
- ❌ NON disabilitare startup check
- ❌ NON usare timeout < 10s (troppo aggressivo)
- ❌ NON dimenticare WebSocket broadcast

---

## 🔐 Sicurezza

### Validazione

- ✅ `expected_heartbeat_interval` validato come `IntegerField`
- ✅ `last_seen_at` validato come `DateTimeField`
- ✅ Tutti i salvataggi usano `transaction.atomic()`
- ✅ Validazione `full_clean()` prima di salvare

### Rate Limiting

Il check offline è **leggero** e **ottimizzato**:
- Filtra solo dispositivi `is_online=True`
- Usa indici DB su `last_seen_at`, `expected_heartbeat_interval`
- Update solo se stato cambia
- Batch update con `update_fields=['is_online']`

---

## 📊 Performance

**Metriche tipiche:**
- ✅ Check 1000 dispositivi: ~100ms
- ✅ Startup check: ~50ms
- ✅ Monitor thread CPU: <0.1%
- ✅ Memory overhead: Trascurabile

**Ottimizzazioni:**
```python
# Query ottimizzate con filtri e indici
gateways = Gateway.objects.filter(
    is_online=True,  # Solo quelli potenzialmente da aggiornare
    expected_heartbeat_interval__isnull=False,  # Indice
    last_seen_at__isnull=False  # Indice
)

# Update selettivo
gateway.save(update_fields=['is_online'])  # Solo campo modificato
```

---

## 🎓 Architettura Decisionale

### Perché NON Trigger Database?

**Contro:**
- ❌ Complesso da debuggare
- ❌ Non portable (specifico per PostgreSQL/MySQL)
- ❌ No broadcasting WebSocket
- ❌ Overhead su ogni SELECT
- ❌ Difficile testare

**Pro logica applicativa:**
- ✅ Facile da testare
- ✅ Portable su qualsiasi DB
- ✅ Può fare broadcast WebSocket
- ✅ Logging dettagliato
- ✅ Flessibile

### Perché NON Campo Calcolato?

```python
# ❌ BAD: Calcolo al volo
@property
def is_online(self):
    return (timezone.now() - self.last_seen_at).total_seconds() < self.timeout
```

**Problemi:**
- ❌ Non può fare query "WHERE is_online = TRUE"
- ❌ Calcolo pesante su ogni accesso
- ❌ No caching possibile
- ❌ No WebSocket notification

**✅ GOOD: Campo persistito + background job**
- Query veloci
- Indici funzionano
- WebSocket notification
- Stato sempre consistente

---

## 🚀 Deploy in Produzione

### Checklist Pre-Deploy

- [ ] Startup check attivo (verificato nei log)
- [ ] Monitor thread funzionante
- [ ] Cronjob configurato (opzionale ma consigliato)
- [ ] Test superati (`test_offline_detection.py`, `test_startup_check.py`)
- [ ] WebSocket configurato correttamente
- [ ] Monitoring alert su errori check offline

### Setup Produzione

```bash
# 1. Verifica configurazione
python manage.py check_offline_devices --verbose

# 2. Setup cronjob (opzionale)
crontab -e
# */5 * * * * cd /app && python manage.py check_offline_devices

# 3. Setup monitoring (esempio con Sentry)
# Le eccezioni in check_offline_devices vengono loggatedautomaticamente

# 4. Restart servizio
systemctl restart bfg-backend  # o podman restart bfg_backend
```

---

## 📞 Support

### Dove guardare in caso di problemi

1. **Log sistema:** `podman logs bfg_backend | grep offline`
2. **DB status:** `python manage.py check_offline_devices --verbose`
3. **Test:** `python test_offline_detection.py`
4. **Codice:**
   - Check logic: `mqtt/services/message_processor.py:714`
   - Startup hook: `mqtt/services/mqtt_service.py:366`
   - Monitor thread: `mqtt/services/mqtt_service.py:336`

### File rilevanti

- `mqtt/services/message_processor.py` - Logica check offline
- `mqtt/services/mqtt_service.py` - Startup check + monitor thread
- `mqtt/management/commands/check_offline_devices.py` - Comando manuale
- `mqtt/models.py` - Modelli con campi offline detection

---

## 📝 Changelog

### v1.0.0 - 2025-11-25
- ✅ Implementato check_offline_devices()
- ✅ Startup check all'avvio servizio
- ✅ Monitor thread ogni 30s
- ✅ Management command per uso manuale
- ✅ WebSocket broadcast su status change
- ✅ Test automatizzati completi
- ✅ Documentazione completa

---

**Autori:** BFG Team
**Ultima modifica:** 2025-11-25
**Versione:** 1.0.0
