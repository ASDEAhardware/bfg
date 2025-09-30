import os
from rest_framework.authentication import BaseAuthentication #type: ignore
from rest_framework.exceptions import AuthenticationFailed #type: ignore

class APIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        secret_key = os.getenv("SECRET_API_KEY")
        provided_key = request.headers.get("X-API-KEY")

        if not provided_key:
            raise AuthenticationFailed("API key missing")
        if provided_key != secret_key:
            raise AuthenticationFailed("Invalid API key")

        # Non associamo un "user" vero e proprio, ma possiamo restituire None
        return (None, None)
    
