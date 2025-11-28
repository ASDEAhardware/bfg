# MQTT Architecture Documentation

> **Comprehensive documentation for BFG MQTT monitoring system refactoring**

---

## 📖 Quick Start

**For an AI implementing this system:**

1. **Read** → [`00_OVERVIEW.md`](00_OVERVIEW.md) - Contesto globale e obiettivo finale
2. **Audit** → [`01_CURRENT_STATE.md`](01_CURRENT_STATE.md) - Cosa esiste, cosa manca
3. **Design** → [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) - Architettura target dettagliata
4. **Plan** → [`03_IMPLEMENTATION_PLAN.md`](03_IMPLEMENTATION_PLAN.md) - Fasi con priorità
5. **Implement** → `phases/PHASE_XX_*.md` - Esegui fase per fase

---

## 🎯 Obiettivo Finale

Sistema real-time di acquisizione e visualizzazione dati IoT via MQTT con:

✅ **Auto-start** - Connessioni MQTT auto-avviano all'avvio container
✅ **Auto-healing** - Monitor thread (30s) garantisce allineamento DB↔Service
✅ **Manual control** - Admin può start/stop via UI (async via monitor)
✅ **Real-time feedback** - WebSocket notifica stato istantaneamente
✅ **Flexible parsing** - Parser configurabili (Pydantic + Registry)
✅ **Auto-discovery** - Tutti i topic tracciati anche se non parsati
✅ **Robust logging** - Errori in DB + file separati
✅ **Type-safe** - Validazione Pydantic per JSON MQTT
✅ **Observable** - Sentry integration per error tracking

---

## 📂 Struttura Documentazione

```
docs/mqtt/
├── README.md                    ← Questo file
├── 00_OVERVIEW.md               ← Contesto globale architettura
├── 01_CURRENT_STATE.md          ← Audit implementazione attuale
├── 02_ARCHITECTURE.md           ← Architettura target dettagliata
├── 03_IMPLEMENTATION_PLAN.md    ← Piano sviluppo con priorità
├── phases/
│   ├── PHASE_01_database_refactoring.md       (30min - CRITICAL)
│   ├── PHASE_02_monitor_thread_refactoring.md (1h - CRITICAL)
│   ├── PHASE_03_api_endpoints.md              (30min - HIGH)
│   ├── PHASE_04_parser_registry.md            (3h - HIGH)
│   ├── PHASE_05_websocket_events.md           (1h - MEDIUM)
│   ├── PHASE_06_frontend_integration.md       (30min - MEDIUM)
│   ├── PHASE_07_logging_system.md             (2h - LOW)
│   └── PHASE_08_sentry_integration.md         (15min - LOW)
└── testing/
    ├── integration_tests.md
    └── manual_test_checklist.md
```

---

## 🚀 Implementation Roadmap

### **WAVE 1: Foundation (CRITICAL)** - Est. 2h
```
PHASE 1: Database Refactoring        (30min)
  ↓
PHASE 2: Monitor Thread Refactoring  (1h)
  ↓
PHASE 3: API Endpoints Refactoring   (30min)
```

**Deploy** → Test on staging → Deploy to production

---

### **WAVE 2: Extensibility (HIGH)** - Est. 3h
```
PHASE 4: Parser Registry System      (3h)
```

**Deploy** → Test parsing with real MQTT messages

---

### **WAVE 3: UX & Observability (MEDIUM/LOW)** - Est. 4h
```
PHASE 5: WebSocket Events Enhancement  (1h)
  ↓
PHASE 6: Frontend UI Enhancements      (30min)
  ↓
PHASE 7: Logging System                (2h)
  ↓
PHASE 8: Sentry Integration            (15min)
```

**Deploy** → Full system operational

---

## 📊 Current vs Target State

| Feature | Current | Target | Phase |
|---------|---------|--------|-------|
| DB naming | `is_enabled`, `is_processed` | `is_active`, `is_processable` | PHASE 1 |
| Monitor thread | ✅ Exists | ✅ Refactored with logging | PHASE 2 |
| API behavior | ⚠️ Direct service call? | 🎯 DB-only (async) | PHASE 3 |
| Parser system | ⚠️ Hardcoded methods | 🎯 Registry + Pydantic | PHASE 4 |
| WebSocket events | ✅ Basic | 🎯 Enhanced | PHASE 5 |
| Frontend UX | ✅ Works | 🎯 Loading feedback | PHASE 6 |
| Logging | ⚠️ File only | 🎯 DB + File separated | PHASE 7 |
| Error tracking | ❌ None | 🎯 Sentry | PHASE 8 |

---

## 🔑 Key Architectural Decisions

### **1. DB-Driven Monitor Thread**

**Decision**: Monitor thread polls DB ogni 30s per determinare connessioni da start/stop.

**Rationale**:
- ✅ Simple - No event bus/queue needed
- ✅ Reliable - DB is source of truth
- ✅ Decoupled - API doesn't call service directly
- ⚠️ Max 30s delay - Acceptable per requirement

**Alternative rejected**: API calls service directly → Too coupled, harder to scale

---

### **2. Pydantic + Registry for Parsers**

**Decision**: Parser configurabili con Pydantic schemas + Registry pattern.

**Rationale**:
- ✅ Type-safe - Validazione automatica JSON
- ✅ Extensible - Facile aggiungere nuovi parser
- ✅ Testable - Schema validation separato da business logic
- ✅ Auto-documented - Pydantic genera schema

**Alternative rejected**:
- ❌ YAML config - Meno flessibile per logica complessa
- ❌ Django Admin config - Troppo complicato

---

### **3. Sentry for Error Tracking**

**Decision**: Integrare Sentry subito (PHASE 8).

**Rationale**:
- ✅ Easy - Letteralmente 5 righe di setup
- ✅ Valuable - Real-time error alerts
- ✅ Low risk - Non impatta codice esistente

**Alternative rejected**: Celery/Redis → Overkill per now, considerare dopo

---

## 🧪 Testing Strategy

### **Livelli di Testing**

1. **Unit Tests** - Ogni fase include unit tests per modelli/funzioni
2. **Integration Tests** - Test end-to-end del flusso completo
3. **Manual Tests** - Checklist verifiche manuali post-deploy

### **Test Criticali**

```python
# MUST PASS prima di deploy

test_monitor_thread_connects_active_sites()
test_monitor_thread_disconnects_inactive_sites()
test_api_start_only_changes_db_flag()
test_websocket_notifies_on_connection_change()
test_parser_validates_and_saves_telemetry()
test_parsing_error_creates_log_entry()
```

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 5.0+ | Backend framework |
| Channels | 4.0+ | WebSocket support |
| paho-mqtt | 1.6+ | MQTT client |
| Pydantic | 2.0+ | Data validation (NEW in PHASE 4) |
| sentry-sdk | 2.0+ | Error tracking (NEW in PHASE 8) |

**Install**:
```bash
pip install pydantic>=2.0.0
pip install sentry-sdk>=2.0.0
```

---

## 🛠️ Development Workflow

### **Per ogni PHASE**:

1. **Read** fase document (`phases/PHASE_XX_*.md`)
2. **Implement** seguendo step-by-step
3. **Test** con unit + integration tests
4. **Verify** success criteria checklist
5. **Commit** con message descrittivo
6. **Deploy** su staging se critical

### **Commit Message Format**:
```
[MQTT][PHASE-X] Breve descrizione

- Dettaglio 1
- Dettaglio 2

Closes #PHASE-X
```

---

## 🚨 Rollback Plan

### **Se una fase fallisce**:

1. **Stop** - Non procedere con fasi successive
2. **Analyze** - Check logs (`logs/mqtt_*.log`, Sentry)
3. **Rollback** migrations se necessario:
   ```bash
   python manage.py migrate mqtt <previous_migration>
   ```
4. **Fix** offline su branch separato
5. **Re-test** completamente prima di retry

### **Critical Paths to Protect**:

- ⚠️ Monitor thread loop - Se va in loop infinito, kill service
- ⚠️ WebSocket broadcast - Se crashano, frontend non riceve updates
- ⚠️ Parser registry - Se invalid parser, può bloccare tutti i messaggi

---

## 📈 Success Metrics (Post-Implementation)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Connection uptime | > 99% | `MqttConnection.last_heartbeat_at` |
| Parsing success rate | > 95% | Count `MqttParsingLog` vs messages |
| WebSocket latency | < 500ms | Frontend timing |
| Monitor cycle time | < 5s | Log timestamps |
| API response time | < 200ms | Django debug toolbar |
| Error rate | < 0.1% | Sentry dashboard |

---

## 🎓 For AI Implementation

### **Critical Understanding Checkpoints**:

1. ✅ **Monitor Thread Role**: Polls DB ogni 30s, non event-driven
2. ✅ **API Behavior**: Sets flags, doesn't call service directly
3. ✅ **WebSocket Flow**: Backend → Channels → Frontend (React Query invalidate)
4. ✅ **Parser Registry**: Pydantic validates → Parser processes → DB save
5. ✅ **Naming Convention**: `is_active` everywhere (omogeneità)

### **Common Pitfalls to Avoid**:

- ❌ Don't make API call service directly (breaks architecture)
- ❌ Don't hardcode new parsers (use registry)
- ❌ Don't skip logging (critical for debug)
- ❌ Don't forget WebSocket broadcast after DB changes
- ❌ Don't mix `is_enabled` and `is_active` (rename all)

---

## 📞 Support & Questions

**Issues con implementazione?**
1. Check logs: `logs/mqtt_connections.log`, `logs/mqtt_parsing.log`
2. Check Django Admin: `/admin/mqtt/`
3. Check Sentry: Error tracking dashboard

**Dubbi architetturali?**
- Re-read `02_ARCHITECTURE.md` per design decisions
- Re-read fase specifica in `phases/`

---

## 🏁 Next Step

**Ready to implement?**

```bash
# Read overview
cat docs/mqtt/00_OVERVIEW.md

# Read current state
cat docs/mqtt/01_CURRENT_STATE.md

# Read architecture
cat docs/mqtt/02_ARCHITECTURE.md

# Read implementation plan
cat docs/mqtt/03_IMPLEMENTATION_PLAN.md

# Start Phase 1
cat docs/mqtt/phases/PHASE_01_database_refactoring.md
```

**Command to AI**:
```
"Leggi docs/mqtt/phases/PHASE_01_database_refactoring.md e implementa"
```

---

**Documentation Version**: 1.0
**Last Updated**: 2025-01-27
**Status**: ✅ Ready for Implementation
**Total Estimated Time**: ~9 hours (across 8 phases)

---

🚀 **Happy Coding!**
