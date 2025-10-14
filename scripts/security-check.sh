#!/bin/bash

# ========================================
# SCRIPT DI VERIFICA SICUREZZA BFG
# ========================================

set -e

echo "🔒 BFG Security Check Script"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "ERROR")
            echo -e "${RED}❌ ERROR: $message${NC}"
            ((ERRORS++))
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  WARNING: $message${NC}"
            ((WARNINGS++))
            ;;
        "OK")
            echo -e "${GREEN}✅ OK: $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO: $message${NC}"
            ;;
    esac
}

echo ""
echo "🔍 Checking security configuration..."

# 1. Check if running in production mode
if [ "$NODE_ENV" = "production" ]; then
    print_status "OK" "Node environment set to production"
else
    print_status "WARNING" "Node environment not set to production (current: ${NODE_ENV:-'not set'})"
fi

# 2. Check Docker containers are running
echo ""
echo "🐳 Checking Docker containers..."
if command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    print_status "ERROR" "Neither podman-compose nor docker-compose found"
    exit 1
fi

if $COMPOSE_CMD ps | grep -q "Up"; then
    print_status "OK" "Docker containers are running"
else
    print_status "ERROR" "Docker containers are not running"
fi

# 3. Check for sensitive files
echo ""
echo "🔐 Checking for sensitive files..."

SENSITIVE_FILES=(
    ".env"
    "backend/keys/private.pem"
    "backend/keys/public.pem"
    "backend/logs/security.log"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check file permissions
        if [ "$file" = "backend/keys/private.pem" ]; then
            PERMS=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
            if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
                print_status "OK" "Private key has secure permissions ($PERMS)"
            else
                print_status "ERROR" "Private key has insecure permissions ($PERMS). Should be 600 or 400"
            fi
        else
            print_status "OK" "Found required file: $file"
        fi
    else
        print_status "WARNING" "Missing file: $file"
    fi
done

# 4. Check environment variables
echo ""
echo "🌍 Checking environment variables..."

REQUIRED_ENV_VARS=(
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
)

for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        print_status "OK" "Environment variable $var is set"
    else
        print_status "ERROR" "Environment variable $var is not set"
    fi
done

# 5. Check default passwords
echo ""
echo "🔑 Checking for default passwords..."

if [ "$POSTGRES_PASSWORD" = "password" ] || [ "$POSTGRES_PASSWORD" = "postgres" ]; then
    print_status "ERROR" "Using default database password. Change it immediately!"
fi

# 6. Test API endpoints
echo ""
echo "🌐 Testing API endpoints..."

BASE_URL="http://localhost:3000"
if command -v curl &> /dev/null; then
    # Test health endpoint
    if curl -s -f "$BASE_URL/api/health" > /dev/null; then
        print_status "OK" "Health endpoint accessible"
    else
        print_status "WARNING" "Health endpoint not accessible"
    fi

    # Test security headers
    SECURITY_HEADERS=$(curl -s -I "$BASE_URL" | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)")
    if [ -n "$SECURITY_HEADERS" ]; then
        print_status "OK" "Security headers present"
    else
        print_status "WARNING" "Security headers missing"
    fi

    # Test rate limiting
    echo "Testing rate limiting..."
    for i in {1..10}; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
        if [ "$RESPONSE" = "429" ]; then
            print_status "OK" "Rate limiting is working (got 429 on attempt $i)"
            break
        fi
        if [ "$i" = "10" ]; then
            print_status "WARNING" "Rate limiting may not be working properly"
        fi
    done
else
    print_status "WARNING" "curl not available, skipping API tests"
fi

# 7. Check Django security
echo ""
echo "🔧 Checking Django security settings..."

if $COMPOSE_CMD exec backend python manage.py check --deploy --settings=config.settings 2>/dev/null; then
    print_status "OK" "Django security check passed"
else
    print_status "WARNING" "Django security check found issues"
fi

# 8. Check logs for security events
echo ""
echo "📋 Checking recent security logs..."

if [ -f "backend/logs/security.log" ]; then
    RECENT_EVENTS=$(tail -n 10 backend/logs/security.log | wc -l)
    if [ "$RECENT_EVENTS" -gt 0 ]; then
        print_status "INFO" "Found $RECENT_EVENTS recent security log entries"
        print_status "INFO" "Last security event:"
        tail -n 1 backend/logs/security.log
    else
        print_status "INFO" "No recent security events"
    fi
else
    print_status "WARNING" "Security log file not found"
fi

# 9. Check SSL certificates (if in production)
if [ "$NODE_ENV" = "production" ]; then
    echo ""
    echo "🔒 Checking SSL configuration..."

    if [ -n "$FRONTEND_URL" ]; then
        DOMAIN=$(echo "$FRONTEND_URL" | sed 's|https\?://||' | sed 's|/.*||')
        if command -v openssl &> /dev/null; then
            if echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
                print_status "OK" "SSL certificate is valid"
            else
                print_status "ERROR" "SSL certificate check failed"
            fi
        else
            print_status "WARNING" "OpenSSL not available, skipping certificate check"
        fi
    else
        print_status "WARNING" "FRONTEND_URL not set, skipping SSL check"
    fi
fi

# 10. Check file integrity
echo ""
echo "🔍 Checking critical file integrity..."

CRITICAL_FILES=(
    "backend/config/settings.py"
    "frontend/src/lib/axios.ts"
    "backend/core/middleware.py"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check for suspicious modifications
        if grep -q "DEBUG.*True" "$file" && [ "$NODE_ENV" = "production" ]; then
            print_status "WARNING" "Debug mode may be enabled in production file: $file"
        fi

        if grep -q "password.*=.*password" "$file"; then
            print_status "ERROR" "Default password found in: $file"
        fi

        print_status "OK" "File integrity check passed: $file"
    else
        print_status "ERROR" "Critical file missing: $file"
    fi
done

# Summary
echo ""
echo "================================================"
echo "🔒 Security Check Summary"
echo "================================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_status "OK" "All security checks passed! 🎉"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    print_status "WARNING" "Security check completed with $WARNINGS warnings"
    echo ""
    echo "Your application has minor security concerns but is generally secure."
    echo "Please review the warnings above."
    exit 0
else
    print_status "ERROR" "Security check failed with $ERRORS errors and $WARNINGS warnings"
    echo ""
    echo "⚠️  CRITICAL: Your application has security vulnerabilities that must be fixed!"
    echo "Please address all errors before deploying to production."
    exit 1
fi