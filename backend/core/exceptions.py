import logging
from rest_framework.views import exception_handler #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework import status #type: ignore
from django.core.exceptions import ValidationError
from django.http import Http404

"""
Questo file definisce un gestore di eccezioni personalizzato per l'API costruita con Django Rest Framework.
Il suo ruolo è quello di intercettare qualsiasi errore (eccezione) non gestito che si verifica durante
l'elaborazione di una richiesta API. Invece di lasciare che DRF restituisca una risposta di errore predefinita, che potrebbe essere poco
chiara o esporre dati sensibili.

Questo sistema viene attivato da:
# settings.py
REST_FRAMEWORK = {
    # ... altre impostazioni
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler'
}

Una volta configurato, ogni volta che un'eccezione (un errore) si verifica all'interno di una vista API e non
viene catturata da un blocco try...except specifico, DRF non userà il suo gestore di default ma invocherà la
funzione custom_exception_handler di questo file.
"""

logger = logging.getLogger('django.security')

def custom_exception_handler(exc, context):
    """
    Custom exception handler per DRF che fornisce:
    - Logging dettagliato degli errori
    - Risposte standardizzate
    - Sicurezza migliorata (no stack traces in produzione)
    """
    # Chiama il gestore di eccezioni predefinito di DRF
    response = exception_handler(exc, context)

    # Se DRF non ha gestito l'eccezione, gestiamo noi
    if response is None:
        return handle_generic_exception(exc, context)

    # Log dell'errore per monitoraggio
    request = context.get('request')
    user = getattr(request, 'user', None)

    error_data = {
        'error_type': exc.__class__.__name__,
        'status_code': response.status_code,
        'path': getattr(request, 'path', 'unknown'),
        'method': getattr(request, 'method', 'unknown'),
        'user': user.username if user and user.is_authenticated else 'anonymous',
        'ip': _get_client_ip(request) if request else 'unknown',
    }

    # Log livello appropriato basato sul tipo di errore
    if response.status_code >= 500:
        logger.error(f"Server Error: {error_data}")
    elif response.status_code >= 400:
        logger.warning(f"Client Error: {error_data}")

    # Standardizza la risposta di errore
    custom_response_data = {
        'error': True,
        'message': _get_error_message(exc, response),
        'code': response.status_code,
        'timestamp': __import__('time').time(),
    }

    # In development, aggiungi dettagli per debugging
    if __import__('django.conf').conf.settings.DEBUG:
        custom_response_data['details'] = response.data
        custom_response_data['exception_type'] = exc.__class__.__name__

    response.data = custom_response_data
    return response


def handle_generic_exception(exc, context):
    """
    Gestisce eccezioni non catturate da DRF
    """
    request = context.get('request')

    # Gestione delle eccezioni di sicurezza personalizzate
    if isinstance(exc, RateLimitExceeded):
        return Response({
            'error': True,
            'message': 'Rate limit exceeded. Try again later.',
            'code': 429,
            'timestamp': __import__('time').time(),
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)

    if isinstance(exc, SuspiciousActivity):
        return Response({
            'error': True,
            'message': 'Invalid request headers',
            'code': 400,
            'timestamp': __import__('time').time(),
        }, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, RequestTooLarge):
        return Response({
            'error': True,
            'message': 'Request entity too large',
            'code': 413,
            'timestamp': __import__('time').time(),
        }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    if isinstance(exc, Http404):
        return Response({
            'error': True,
            'message': 'Resource not found',
            'code': 404,
            'timestamp': __import__('time').time(),
        }, status=status.HTTP_404_NOT_FOUND)

    if isinstance(exc, ValidationError):
        return Response({
            'error': True,
            'message': 'Validation error',
            'code': 400,
            'details': exc.message_dict if hasattr(exc, 'message_dict') else str(exc),
            'timestamp': __import__('time').time(),
        }, status=status.HTTP_400_BAD_REQUEST)

    # Errore generico del server
    logger.error(f"Unhandled exception: {exc.__class__.__name__}: {str(exc)}")

    return Response({
        'error': True,
        'message': 'Internal server error',
        'code': 500,
        'timestamp': __import__('time').time(),
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_error_message(exc, response):
    """
    Estrae un messaggio di errore user-friendly
    """
    # Per errori di autenticazione
    if response.status_code == 401:
        return 'Authentication required or token expired'

    # Per errori di autorizzazione
    if response.status_code == 403:
        return 'Access denied - insufficient permissions'

    # Per errori di validazione
    if response.status_code == 400:
        if hasattr(response, 'data') and isinstance(response.data, dict): # isinstance(onj, type) è una funzione python che conrolla se un'oggetto è un'istanza di un certo tipo e restituisce True o False
            # Estrai il primo messaggio di errore
            for field, errors in response.data.items():
                if isinstance(errors, list) and errors:
                    return f"Validation error in {field}: {errors[0]}"
                return f"Validation error in {field}: {errors}"
        return 'Bad request - validation failed'

    # Per errori di rate limiting
    if response.status_code == 429:
        return 'Too many requests - please slow down'

    # Messaggio generico
    return getattr(exc, 'detail', str(exc)) if hasattr(exc, 'detail') else str(exc)


def _get_client_ip(request):
    """Ottiene l'IP reale del client"""
    if not request:
        return 'unknown'

    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', 'unknown')
    return ip


# Classi utilizzate in ./middleware.py

class SecurityException(Exception):
    """
    Eccezione personalizzata per violazioni di sicurezza
    """
    def __init__(self, message, error_code=None, ip_address=None):
        self.message = message
        self.error_code = error_code
        self.ip_address = ip_address
        super().__init__(self.message)


class RateLimitExceeded(SecurityException):
    """
    Eccezione per rate limiting superato
    """
    def __init__(self, ip_address, limit_type='general'):
        message = f"Rate limit exceeded for {limit_type}"
        super().__init__(message, 'RATE_LIMIT_EXCEEDED', ip_address)


class SuspiciousActivity(SecurityException):
    """
    Eccezione per attività sospette
    """
    def __init__(self, activity_type, ip_address, details=None):
        message = f"Suspicious activity detected: {activity_type}"
        if details:
            message += f" - {details}"
        super().__init__(message, 'SUSPICIOUS_ACTIVITY', ip_address)


class RequestTooLarge(SecurityException):
    """
    Eccezione per richieste con body troppo grande
    """
    def __init__(self, ip_address, size):
        message = f"Request from {ip_address} is too large: {size} bytes"
        super().__init__(message, 'REQUEST_TOO_LARGE', ip_address)