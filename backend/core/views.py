import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework import status #type: ignore
from django.conf import settings #type: ignore
from pathlib import Path #type: ignore
from .authentication import APIKeyAuthentication

logger = logging.getLogger('django.security')


class PublicKeyView(APIView):
    """
    Espone la chiave pubblica per la validazione dei token JWT.
    """
    authentication_classes = [APIKeyAuthentication] # Non richiede autenticazione
    permission_classes = []     # Non richiede permessi

    def get(self, request):
        try:
            # Assicurati che il percorso della chiave pubblica sia corretto
            base_dir = Path(settings.BASE_DIR)
            public_key_path = base_dir / 'keys' / 'public.pem'
            
            with open(public_key_path, 'r') as f:
                public_key = f.read()

            # Restituisce la chiave pubblica in un formato JSON
            return Response({'public_key': public_key}, status=status.HTTP_200_OK)
        except FileNotFoundError:
            # Gestisce il caso in cui il file non venga trovato
            return Response(
                {'error': 'Public key file not found.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            # Gestisce altri possibili errori
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def csrf_failure(request, reason=""):
    """
    Vista personalizzata per gestire fallimenti CSRF
    """
    logger.warning(f"CSRF failure from IP {_get_client_ip(request)}: {reason}")
    return JsonResponse(
        {
            'error': 'CSRF verification failed',
            'message': 'Request blocked for security reasons'
        },
        status=403
    )


@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    """
    Endpoint per health check del sistema
    """
    return JsonResponse({
        'status': 'healthy',
        'timestamp': __import__('time').time(),
        'version': getattr(settings, 'APP_VERSION', '1.0.0')
    })


@csrf_exempt
@require_http_methods(["GET"])
def security_headers_test(request):
    """
    Endpoint per testare security headers
    """
    response = JsonResponse({
        'message': 'Security headers test',
        'headers_received': dict(request.headers)
    })

    # Test security headers
    response['X-Security-Test'] = 'active'
    return response


def _get_client_ip(request):
    """Utility per ottenere IP client"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

