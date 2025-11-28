#!/bin/bash
# MQTT Implementation Verification Script
# Verifica che PHASE 1, 2, 3 siano implementate correttamente

echo "=================================="
echo "MQTT IMPLEMENTATION VERIFICATION"
echo "=================================="
echo ""

ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

check_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

echo "=== PHASE 1: Database Refactoring ==="
echo ""

# Check migrations
echo "Checking migrations..."
MIGRATIONS=$(podman exec bfg_backend python manage.py showmigrations mqtt 2>/dev/null | grep "0025\|0026" | grep -c "\[X\]")
if [ "$MIGRATIONS" -eq 2 ]; then
    check_pass "Migrations 0025 and 0026 applied"
else
    check_fail "Migrations missing (found $MIGRATIONS/2)"
fi

# Check models exist
echo ""
echo "Checking models..."
MODEL_CHECK=$(podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection, MqttConnectionLog, MqttParsingLog, DiscoveredTopic
conn = MqttConnection.objects.first()
has_is_active = hasattr(conn, 'is_active')
topic = DiscoveredTopic.objects.first()
has_processable = hasattr(topic, 'is_processable') if topic else True
has_active = hasattr(topic, 'is_active') if topic else True
print(f'{has_is_active},{has_processable},{has_active}')
" 2>/dev/null | tail -1)

if [[ "$MODEL_CHECK" == *"True,True,True"* ]]; then
    check_pass "All model fields correct (is_active, is_processable)"
else
    check_fail "Model fields missing or incorrect"
fi

# Check log models
LOG_MODELS=$(podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnectionLog, MqttParsingLog
print('OK')
" 2>/dev/null | grep -c "OK")

if [ "$LOG_MODELS" -eq 1 ]; then
    check_pass "Log models (MqttConnectionLog, MqttParsingLog) exist"
else
    check_fail "Log models not found"
fi

echo ""
echo "=== PHASE 2: Monitor Thread & Logging ==="
echo ""

# Check logging_utils.py exists
if [ -f "backend/mqtt/logging_utils.py" ]; then
    check_pass "logging_utils.py exists"
else
    check_fail "logging_utils.py missing"
fi

# Check monitor is running
MONITOR_RUNNING=$(podman logs --tail 100 bfg_backend 2>/dev/null | grep -c "MQTT Monitor started")
if [ "$MONITOR_RUNNING" -gt 0 ]; then
    check_pass "Monitor thread is running"
else
    check_fail "Monitor thread not detected in logs"
fi

# Test logging function
echo ""
echo "Testing logging system..."
TEST_LOG=$(podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection, MqttConnectionLog
from mqtt.logging_utils import log_connection_event
conn = MqttConnection.objects.first()
if conn:
    initial_count = MqttConnectionLog.objects.count()
    log_connection_event(conn, 'INFO', 'VERIFICATION_TEST_LOG')
    new_count = MqttConnectionLog.objects.count()
    print(f'{new_count > initial_count}')
else:
    print('False')
" 2>/dev/null | tail -1)

if [[ "$TEST_LOG" == *"True"* ]]; then
    check_pass "Logging system works (creates DB entries)"
else
    check_fail "Logging system not working"
fi

echo ""
echo "=== PHASE 3: API Endpoints ==="
echo ""

# Check API views updated
API_UPDATED=$(grep -c "HTTP_202_ACCEPTED" backend/mqtt/api/views.py 2>/dev/null)
if [ "$API_UPDATED" -gt 0 ]; then
    check_pass "API endpoints return HTTP 202 (async pattern)"
else
    check_fail "API endpoints not updated to HTTP 202"
fi

# Check serializers use is_active
SERIALIZER_OK=$(grep -c "is_active" backend/mqtt/api/serializers.py 2>/dev/null)
if [ "$SERIALIZER_OK" -gt 0 ]; then
    check_pass "Serializers use is_active field"
else
    check_fail "Serializers not updated"
fi

echo ""
echo "==================================="
echo "VERIFICATION SUMMARY"
echo "==================================="
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo ""
    echo "Your MQTT implementation is ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Test manually: See MQTT_IMPLEMENTATION_SUMMARY.md"
    echo "  2. Check logs: podman logs bfg_backend | grep Monitor"
    echo "  3. Test API: Enable/disable a connection and wait 30s"
    exit 0
else
    echo -e "${RED}✗ $ERRORS CHECKS FAILED${NC}"
    echo ""
    echo "Please review the failed checks above."
    echo "See MQTT_IMPLEMENTATION_SUMMARY.md for troubleshooting."
    exit 1
fi
