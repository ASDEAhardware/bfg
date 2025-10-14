from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework import status #type: ignore
from django.conf import settings #type: ignore
from pathlib import Path #type: ignore
from .authentication import APIKeyAuthentication


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

