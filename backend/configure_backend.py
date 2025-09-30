
import os
from pathlib import Path

# Funzione per configurare settings.py del progetto Django

import os
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Funzione per configurare settings.py del progetto Django
def configure_settings():
    base_dir = Path(__file__).resolve().parent
    settings_path = base_dir / "config" / "settings.py"

    if not settings_path.exists():
        print("❌ File settings.py non trovato. Assicurati di aver eseguito bootstrap.sh.")
        return

    #----------------- GENERAZIONE CHIAVI RSA -----------------

    # Inizio della generazione delle chiavi
    keys_dir = base_dir / 'keys'
    private_key_path = keys_dir / 'private.pem'
    public_key_path = keys_dir / 'public.pem'

    if not private_key_path.exists() or not public_key_path.exists():
        print("Chiavi RSA non trovate. Generazione in corso...")
        os.makedirs(keys_dir, exist_ok=True)
        
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
        public_key = private_key.public_key()
        
        with open(private_key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))

        with open(public_key_path, "wb") as f:
            f.write(public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
        print("Chiavi generate con successo.")
    else:
        print("Chiavi RSA già esistenti. Salto la generazione.")

    with open(settings_path, "r") as f:
        content = f.read()
    
    #-----------------FINE CODICE DI GENERAZIONE CHIAVI RSA-----------------

    # Aggiungi le app all'INSTALLED_APPS
    new_apps = "" #"new_apps" deve essere sempre dichiarata prima di lavorarci
    if "rest_framework" not in content:
      new_apps = """
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework.authtoken',
    'dj_rest_auth',
    #'dj_rest_auth.registration',  # Se vuoi usare la registrazione
    'django.contrib.sites',  # Necessario per alcune funzioni (come il reset password)
    'user',
    'corsheaders',
    'dashboard',
"""

    # Trova il punto di inserimento prima della chiusura di INSTALLED_APPS
    idx = content.find("INSTALLED_APPS = [")
    if idx != -1:
        start_idx = content.find("[", idx) + 1
        end_idx = content.find("]", start_idx)

        # Inserisce le nuove app subito prima della chiusura
        updated_apps = content[start_idx:end_idx].rstrip()
        updated_apps += new_apps

        content = content[:start_idx] + updated_apps + content[end_idx:]
    
    # Aggiungi corsheaders middleware
    if "corsheaders.middleware.CorsMiddleware" not in content:
        content = content.replace(
            "MIDDLEWARE = [",
            """MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
"""
        )

    content = content.replace(
        "DEBUG = True",
        "DEBUG = os.environ.get('DEBUG', 'True') == 'True'")

    content = content.replace(
        "from pathlib import Path",
        "from pathlib import Path\nimport os\nfrom datetime import timedelta\n"
    )

    #ALLOWED_HOSTS REPLACEMENT
    if "ALLOWED_HOSTS" in content:
        content = content.replace(
            "ALLOWED_HOSTS = []",
            "ALLOWED_HOSTS= [ 'backend', 'localhost', '127.0.0.1' ]" #"backend" é il nome del servizio docker per permettere le chiamate api server to server
        )

    # Imposta DATABASES
    if "DATABASES" in content:
        # Rimuove configurazioni precedenti di DATABASES
        content = content.split("DATABASES")[0]

    content = content.replace(
        "'DIRS': [],",
        "'DIRS': [BASE_DIR / 'templates'],"
    )


    content += """

# Configurazione database PostgreSQL

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB'),
        'USER': os.environ.get('POSTGRES_USER'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD'),
        'HOST': os.environ.get('POSTGRES_HOST'),
        'PORT': os.environ.get('POSTGRES_PORT'),
    }
}

# Config REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

AUTH_USER_MODEL = 'user.CustomUser'
STATIC_URL = '/static/'
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'

# Aggiungi CORS_ALLOWED_ORIGINS
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

CORS_ALLOW_CREDENTIALS = True  # Permette l'invio di cookie con CORS

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
]

SIMPLE_JWT = {
    # Specifica l'algoritmo di firma
    "ALGORITHM": "RS256",

    # Carica la chiave privata per firmare i token
    "SIGNING_KEY": open(BASE_DIR / 'keys' / 'private.pem').read(),

    # Carica la chiave pubblica per verificare i token
    "VERIFYING_KEY": open(BASE_DIR / 'keys' / 'public.pem').read(),

    # Aggiungi un endpoint per la gestione del JWKS (opzionale, ma consigliato)
    # Questo non è nativamente supportato da simple_jwt, ma puoi implementarlo
    # come un'API custom su Django per Next.js
    # "JWKS_URI": "/api/auth/jwks/", # Esempio di URL per il JWK Set
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    'JWT_AUTH_REFRESH_COOKIE_MAX_AGE': timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'access_token',
    'JWT_AUTH_COOKIE_PATH': '/',
    'JWT_AUTH_HTTPONLY': False,  # L'access token NON deve essere HttpOnly per essere letto dal middleware
    'JWT_AUTH_SECURE': False,    # ⚠️ Imposta a True in produzione con HTTPS
    'JWT_AUTH_COOKIE_SAMESITE': 'Lax', # Consigliato per lo sviluppo, più permissivo di 'Strict'

    # Configurazione del Cookie per il Refresh Token
    'JWT_AUTH_REFRESH_COOKIE': 'refresh_token',  # Questo è il nome del cookie per il REFRESH TOKEN.
    'JWT_AUTH_REFRESH_COOKIE_PATH': '/',
    'JWT_AUTH_REFRESH_COOKIE_HTTP_ONLY': True,  # Il refresh token DEVE essere HttpOnly
    'JWT_AUTH_REFRESH_COOKIE_SECURE': False,    # ⚠️ Imposta a True in produzione con HTTPS
    'JWT_AUTH_REFRESH_COOKIE_SAMESITE': 'Lax',


    'LOGIN_SERIALIZER': 'dj_rest_auth.serializers.LoginSerializer',
    'TOKEN_SERIALIZER': 'dj_rest_auth.serializers.TokenSerializer',
    'JWT_SERIALIZER': 'dj_rest_auth.serializers.JWTSerializer', #Si occupa di impacchettare la risposta json in seguito a un login eseguito con successo, non del suo payload
    'JWT_SERIALIZER_WITH_EXPIRATION': 'dj_rest_auth.serializers.JWTSerializerWithExpiration', #Identico al precedente aggiungendo però informazioni sulla scadenza dei token
    'JWT_TOKEN_CLAIMS_SERIALIZER': 'user.serializers.MyTokenObtainPairSerializer', #Si occupa di serializzare il payload del token e di default si basa sul serializzatore di SimpleJWT
    'USER_DETAILS_SERIALIZER': 'user.serializers.CustomUserDetailsSerializer',
    'PASSWORD_RESET_SERIALIZER': 'dj_rest_auth.serializers.PasswordResetSerializer',
    'PASSWORD_RESET_CONFIRM_SERIALIZER': 'dj_rest_auth.serializers.PasswordResetConfirmSerializer',
    'PASSWORD_CHANGE_SERIALIZER': 'dj_rest_auth.serializers.PasswordChangeSerializer',

    'OLD_PASSWORD_FIELD_ENABLED': True,
    'LOGOUT_ON_PASSWORD_CHANGE': True,

    'TOKEN_MODEL': 'rest_framework.authtoken.models.Token',
    'TOKEN_CREATOR': 'dj_rest_auth.utils.default_create_token',
}

DEFAULT_DOMAIN = 'localhost:8000'  # Sostituisci con il tuo dominio reale

FRONTEND_URL = "http://localhost:3000"

DJANGO_REST_AUTH = {
    "PASSWORD_RESET_CONFIRM_URL": "reset-password/confirm?uid={uid}&token={token}",
    'PASSWORD_RESET_SHOW_EMAIL_NOT_FOUND': True,
    "USE_SITES": False,  # In quanto non usiamo il sistema di auth standard di django
    "DOMAIN": "localhost:8000", # Utile se utilizzi "USE_SITES": False
    "SITE_NAME": "LocalDev", # Utile se utilizzi "USE_SITES": False 
}

REST_AUTH_PASSWORD_RESET_SERIALIZER = 'user.serializers.CustomPasswordResetSerializer'

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST')  # SMTP server host
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))  # SMTP server port (587 for TLS, 465 for SSL)
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'  # True for TLS, False for SSL
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')  # SMTP server username
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')  # SMTP server password
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'False'  # Set to True if using SSL
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL')  # Default sender email address !!!!#UNICO PARAMETRO UTILIZZATO IN FASE DI SVILUPPO IN QUANTO ABBIAMO smtp in console

SITE_ID = 1  # Necessario per dj-rest-auth
\'''
SITE_ID = 1  # Necessario per dj-rest-auth, 
indica il sito predefinito per le operazioni di autenticazione e registrazione

SITE_ID = 1 -> è una variabile di configurazione usata da Django's "sites framework", ovvero il sistema django.contrib.sites.
Questo framework per siti multipli consente di gestire più domini o siti web all'interno della stessa istanza di Django.
Il valore 1 indica che il sito corrente è il primo sito registrato nel database.
 
dice a Django di usare il sito con ID 1 nella tabella django_site come sito corrente per:

    generare URL nei reset password/email verification

    identificare il dominio del sito corrente (utile in email o template)

    supportare app come django-allauth, dj-rest-auth, etc.

    !!!!Per modificare il link di reset password, puoi andare in tuo-sito/admin/sites/site/ e 
    modificare il campo "Domain name" per il sito con ID 1. (Questo avviene sempre per la possibilità di avere più siti, in 
    un'istanza Django, ognuno con il proprio dominio e configurazione.)	

\''' 

"""

    with open(settings_path, "w") as f:
        f.write(content)

    print("✅ File settings.py aggiornato correttamente.")

if __name__ == "__main__":
    configure_settings()
