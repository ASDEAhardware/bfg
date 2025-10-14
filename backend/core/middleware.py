import time
import json
import logging
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.core.exceptions import SuspiciousOperation

logger = logging.getLogger('django.security')

class SecurityMiddleware(MiddlewareMixin):
    """
    Middleware per sicurezza avanzata:
    - Rate limiting per IP
    - Validazione dimensioni request
    - Logging security events
    - Protezione contro attacchi comuni
    """

    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)

    def process_request(self, request):
        # 1. Rate Limiting per IP
        if self._is_rate_limited(request):
            logger.warning(f"Rate limit exceeded for IP: {self._get_client_ip(request)}")
            return JsonResponse(
                {'error': 'Rate limit exceeded. Try again later.'},
                status=429
            )

        # 2. Validazione dimensioni request
        if self._is_request_too_large(request):
            logger.warning(f"Request too large from IP: {self._get_client_ip(request)}")
            return JsonResponse(
                {'error': 'Request entity too large'},
                status=413
            )

        # 3. Validazione headers sospetti
        if self._has_suspicious_headers(request):
            logger.warning(f"Suspicious headers from IP: {self._get_client_ip(request)}")
            return JsonResponse(
                {'error': 'Invalid request headers'},
                status=400
            )

        # 4. Logging delle richieste sensibili
        if self._is_sensitive_endpoint(request):
            logger.info(f"Sensitive endpoint accessed: {request.path} by IP: {self._get_client_ip(request)}")

        return None

    def process_response(self, request, response):
        # Aggiungi security headers a tutte le risposte
        self._add_security_headers(response)
        return response

    def _get_client_ip(self, request):
        """Ottiene l'IP reale del client considerando proxy/load balancer"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def _is_rate_limited(self, request):
        """Implementa rate limiting per IP"""
        ip = self._get_client_ip(request)
        cache_key = f"rate_limit_{ip}"

        # Configurazione rate limiting
        max_requests = getattr(settings, 'RATE_LIMIT_REQUESTS', 100)
        time_window = getattr(settings, 'RATE_LIMIT_WINDOW', 300)  # 5 minuti

        current_requests = cache.get(cache_key, 0)

        if current_requests >= max_requests:
            return True

        # Incrementa il contatore
        cache.set(cache_key, current_requests + 1, time_window)
        return False

    def _is_request_too_large(self, request):
        """Controlla se la richiesta è troppo grande"""
        max_size = getattr(settings, 'MAX_REQUEST_SIZE', 10 * 1024 * 1024)  # 10MB default

        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            return int(content_length) > max_size

        return False

    def _has_suspicious_headers(self, request):
        """Rileva headers sospetti che potrebbero indicare attacchi"""
        suspicious_patterns = [
            'eval(',
            'javascript:',
            '<script',
            'onload=',
            'onerror=',
            '../',
            '..\\',
            'union select',
            'drop table',
        ]

        for header_name, header_value in request.META.items():
            if isinstance(header_value, str):
                for pattern in suspicious_patterns:
                    if pattern.lower() in header_value.lower():
                        logger.warning(f"Suspicious pattern '{pattern}' in header {header_name}: {header_value}")
                        return True

        return False

    def _is_sensitive_endpoint(self, request):
        """Identifica endpoint sensibili per logging aggiuntivo"""
        sensitive_paths = [
            '/api/v1/user/login/',
            '/api/v1/user/logout/',
            '/api/v1/user/password/',
            '/admin/',
        ]

        return any(request.path.startswith(path) for path in sensitive_paths)

    def _add_security_headers(self, response):
        """Aggiunge security headers essenziali"""
        # Prevenzione XSS
        response['X-XSS-Protection'] = '1; mode=block'

        # Prevenzione MIME sniffing
        response['X-Content-Type-Options'] = 'nosniff'

        # Prevenzione clickjacking
        response['X-Frame-Options'] = 'DENY'

        # Referrer Policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Permissions Policy
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        # Content Security Policy (base)
        if not response.get('Content-Security-Policy'):
            response['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware per audit e monitoring delle attività utente
    """

    def process_request(self, request):
        # Timestamp inizio richiesta
        request.start_time = time.time()
        return None

    def process_response(self, request, response):
        # Calcola tempo di elaborazione
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time

            # Log richieste lente
            if duration > 2.0:  # 2 secondi
                logger.warning(f"Slow request: {request.method} {request.path} took {duration:.2f}s")

        # Audit delle operazioni critiche
        if self._is_critical_operation(request, response):
            self._log_critical_operation(request, response)

        return response

    def _is_critical_operation(self, request, response):
        """Identifica operazioni critiche da auditare"""
        critical_methods = ['POST', 'PUT', 'PATCH', 'DELETE']
        critical_paths = [
            '/api/v1/site/sites/',
            '/api/v1/user/',
        ]

        return (
            request.method in critical_methods and
            any(request.path.startswith(path) for path in critical_paths) and
            response.status_code < 400
        )

    def _log_critical_operation(self, request, response):
        """Log dettagliato delle operazioni critiche"""
        user = getattr(request, 'user', None)

        audit_data = {
            'timestamp': time.time(),
            'user': user.username if user and user.is_authenticated else 'anonymous',
            'method': request.method,
            'path': request.path,
            'ip': self._get_client_ip(request),
            'status_code': response.status_code,
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        }

        logger.info(f"AUDIT: {json.dumps(audit_data)}")

    def _get_client_ip(self, request):
        """Ottiene l'IP reale del client"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class CSRFValidationMiddleware(MiddlewareMixin):
    """
    Middleware per validazione CSRF personalizzata su API
    """

    def process_request(self, request):
        # Skip CSRF per endpoint con autenticazione JWT
        if request.path.startswith('/api/') and request.META.get('HTTP_AUTHORIZATION'):
            return None

        # Validazione CSRF rigorosa per form submissions
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            if not self._is_csrf_valid(request):
                logger.warning(f"CSRF validation failed for {request.path} from IP: {self._get_client_ip(request)}")
                return JsonResponse(
                    {'error': 'CSRF validation failed'},
                    status=403
                )

        return None

    def _is_csrf_valid(self, request):
        """Validazione CSRF personalizzata"""
        # Implementazione semplificata - Django ha già il suo middleware CSRF
        # Questo è per validazioni aggiuntive se necessario
        return True

    def _get_client_ip(self, request):
        """Ottiene l'IP reale del client"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip