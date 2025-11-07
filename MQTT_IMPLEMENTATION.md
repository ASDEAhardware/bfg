# MQTT Service - Implementazione Produzione

## Cosa è stato fatto

Implementate best practices MQTT per ambiente produzione:

1. **Client ID fisso** - Usa hostname invece di UUID random
2. **Clean Session** - Elimina sessioni zombie sul broker
3. **Last Will and Testament** - Rileva disconnect in <10s invece di 90s
4. **Shutdown parallelo** - Chiusura <1s invece di 10s+ (elimina SIGKILL)
5. **Health endpoint** - Monitoring stato servizio
6. **Cooldown anti-loop** ⚠️ NUOVO - Previene loop infiniti dopo code 7

---

## File modificati

### Backend Python
- `mqtt/services/mqtt_service.py` - Instance ID + shutdown parallelo
- `mqtt/services/mqtt_connection.py` - Clean session + LWT + online status
- `config/settings.py` - Configurazione MQTT_CONFIG
- `mqtt/api/views.py` - Health endpoint
- `mqtt/urls.py` - Route health
- `supervisord.conf` - RPC interface per supervisorctl

### Docker/Compose
- `docker-compose.yml` - Variabili ambiente MQTT

---

## Verifica funzionamento

### 1. Health check (no auth)
```bash
curl http://localhost:8000/api/v1/mqtt/health/
```

**Risposta attesa**:
```json
{
  "status": "healthy",
  "service": { "running": true, "instance_id": "bfg_back" },
  "connections": { "total": 2, "enabled": 2, "healthy": 2, "unhealthy": 0 }
}
```

### 2. Test shutdown veloce
```bash
podman restart bfg_backend
sleep 10
podman logs bfg_backend 2>&1 | tail -30 | grep -E "SIGKILL|All connections"
```

**Atteso**:
- ✅ NO "SIGKILL" nei log
- ✅ "All connections disconnected in 0.XX s" (< 1 secondo)

### 3. Client ID consistente
```bash
podman exec bfg_backend grep "Using client ID" /var/log/mqtt/mqtt_service.err.log | tail -2
```

**Atteso**:
- `site_88_ibfg_back` (sempre uguale)
- `sito_asd_ibfg_back` (sempre uguale)

---

## Comandi utili

```bash
# Status servizio MQTT
podman exec bfg_backend supervisorctl status mqtt_service

# Log MQTT real-time
podman exec bfg_backend tail -f /var/log/mqtt/mqtt_service.err.log

# Health verbose (dettagli connessioni)
curl "http://localhost:8000/api/v1/mqtt/health/?verbose=true"
```

---

## Troubleshooting

### Health ritorna "critical"
```bash
# Verifica servizio running
podman exec bfg_backend supervisorctl status mqtt_service
# Deve essere: RUNNING

# Check log errori
podman exec bfg_backend tail -50 /var/log/mqtt/mqtt_service.err.log
```

### Appare ancora SIGKILL
```bash
# Verifica timing disconnect
podman exec bfg_backend grep "All connections disconnected" /var/log/mqtt/mqtt_service.err.log | tail -1
# Deve essere < 1 secondo
```

### Connessioni unhealthy
```bash
# Check status DB
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
for c in MqttConnection.objects.all():
    print(f'{c.site.name}: {c.status}')
"

# Verifica connettività broker
podman exec bfg_backend ping -c 3 zionnode.ovh
```

### Loop di riconnessione infinito
Se vedi nei log:
```
Unexpected disconnect (code 7)
Connected successfully
Unexpected disconnect (code 7)
...
```

**Soluzione**:
1. Stop il servizio: `podman exec bfg_backend supervisorctl stop mqtt_service`
2. Aspetta 30s che il broker pulisca la sessione
3. Start il servizio: `podman exec bfg_backend supervisorctl start mqtt_service`

Il cooldown di 30s dovrebbe prevenire automaticamente questo problema.

---

## Configurazione

### Variabili ambiente (docker-compose.yml)
```yaml
environment:
  - MQTT_INSTANCE_ID=bfg_back
  - MQTT_CLEAN_SESSION=true
  - MQTT_LWT_ENABLED=true
  - MQTT_KEEP_ALIVE=60
  - MQTT_SHUTDOWN_TIMEOUT=5
```

### Topics MQTT
- `site_88/backend/status` - Status online/offline (LWT)
- `site_88/#` - Subscription wildcard

### Protezione Loop (Cooldown)

**Problema risolto**: Dopo `stop + start`, il broker vedeva connessione duplicata e chiudeva quella "vecchia" (code 7). Il client riconnetteva immediatamente → loop infinito.

**Soluzione**: Quando riceviamo code 7 (broker closed connection):
- Impostiamo cooldown di 30 secondi
- Blocchiamo riconnessioni immediate
- Dopo 30s, il monitor riprova (e il broker ha già pulito la sessione vecchia)

**Log indicativo**:
```
Broker closed connection (code 7) - likely duplicate client ID.
Setting 30s cooldown to prevent reconnect loop.
```

---

## Risultati attesi

| Metrica | Prima | Dopo |
|---------|-------|------|
| Shutdown | 10s + SIGKILL | <1s clean |
| Client ID | Random | Fisso |
| Detect crash | 90s | <10s |
| Duplicati | 2-4 connessioni | 0 |
| Monitoring | Nessuno | /api/v1/mqtt/health/ |

---

## Deploy

```bash
podman-compose down
podman-compose up --build -d
sleep 20
curl http://localhost:8000/api/v1/mqtt/health/
```

---

**Status**: Produzione ✅
**Data**: 2025-11-07
