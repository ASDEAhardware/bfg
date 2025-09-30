import os
import subprocess
from pathlib import Path
backendDir = Path(__file__).resolve().parent

#-----------------------------Funzione che setuppa il progetto backend avviando un progetto django e due app
def run(cmd, cwd=None):
    print(f"⚙️  Eseguendo: {cmd}")
    subprocess.run(cmd, shell=True, check=True, cwd=cwd)





# DEFINIZIONE -> /backend_snippets/api_app.py    
#api_urls
#api_views

# DEFINIZIONE -> /backend_snippets/dashboard_app.py
def dashboard_url_code():
    dashboard_url_path = backendDir / "dashboard" / "urls.py"
    dashboard_url_content = """from django.urls import path #type: ignore

urlpatterns = [
]

"""
    with open(dashboard_url_path, "w", encoding="utf-8") as f:
        f.write(dashboard_url_content)
        print(f"✅ File 'urls.py' creato in: {dashboard_url_path}")


# DEFINIZIONE -> /backend_snippets/config_core.py
def modify_main_urls():
    main_urls_path = backendDir / "config" / "urls.py"
    urls_content = """ # Scrivere in questo file solo gli endpoint per gli sviluppatori
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path('developers-admin/', admin.site.urls),
    path('api/v1/', include('api.v1.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
"""
    with open(main_urls_path, "w", encoding="utf-8") as f:
        f.write(urls_content)
    print(f"✅ File 'urls.py' modificato in: {{main_urls_path}}")



# DEFINIZIONE -> /backend_snippets/user_app.py
def extend_user_model():	
    user_model_path = backendDir / "user" / "models.py"
    user_model_content = """
import os
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


def user_directory_path(instance, filename):
    
    #Genera un percorso univoco per ogni utente, es:
    #profile_images/user_42/uuid.jpg
    
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return f'profile_images/user_{instance.id}/{filename}'


class CustomUser(AbstractUser):
    profile_image = models.ImageField(
        upload_to=user_directory_path,
        blank=True,
        null=True
    )

    def __str__(self):
        return self.username

class UserPreferences(models.Model):
    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('system', 'System'),
    ]
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='system')

    def __str__(self):
        return f"User Preferences for {self.user.username}, theme: {self.theme}"
"""
    with open(user_model_path, "w", encoding="utf-8") as f:
        f.write(user_model_content)
    print(f"✅ File 'models.py' creato in: {user_model_path}", "green")


def add_user_model_to_admin():
    admin_path = backendDir / "user" / "admin.py"
    admin_content = """
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('username', 'email', 'is_staff', 'profile_image')
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("profile_image",)}),
    )
"""
    with open(admin_path, "w", encoding="utf-8") as f:
        f.write(admin_content)
    print(f"✅ File 'admin.py' creato in: {admin_path}", "green")

def user_custom_serializer():
    serializer_path = backendDir/ "user" / "serializers.py"
    serializer_content = """
from dj_rest_auth.serializers import UserDetailsSerializer #type: ignore
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer #type: ignore
from rest_framework import serializers #type: ignore
from .models import UserPreferences

class CustomUserDetailsSerializer(UserDetailsSerializer):
    theme = serializers.SerializerMethodField()

    class Meta(UserDetailsSerializer.Meta):
        fields = UserDetailsSerializer.Meta.fields + ('is_staff', 'is_superuser', 'profile_image', 'theme')

    def get_theme(self, obj):
        # obj è l'istanza di CustomUser
        preferences = UserPreferences.objects.filter(user=obj).first()
        if preferences:
            return preferences.theme
        return 'system'  # Valore di default se non esistono preferenze

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Aggiungi i dati personalizzati al payload del token
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        
        return token
    """
    with open(serializer_path, "w", encoding="utf-8") as f:
        f.write(serializer_content)
    print(f"✅ File 'serializers.py' creato in: {serializer_path}", "green")


# DEFINIZIONE -> /backend_snippets/user_preferences.py    
def user_preference_view():
    file_path = backendDir / "user" / "views.py"
    content = """
from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework.permissions import IsAuthenticated  #type: ignore
from rest_framework import status #type: ignore
from .models import UserPreferences

class ThemePreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        return Response({'theme': user_preferences.theme})

    def put(self, request):
        theme = request.data.get('theme', 'system')
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        user_preferences.theme = theme
        user_preferences.save()

        return Response({'status': 'success', 'theme': theme}, status=status.HTTP_200_OK)    
"""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def user_preference_url():
    file_path = backendDir / "user" / "urls.py"
    content = """
from django.urls import path, include
from .views import ThemePreferencesView

urlpatterns = [
    path("", include("dj_rest_auth.urls")),
    #path("registration/", include("dj_rest_auth.registration.urls")),
    path("theme-preferences/", ThemePreferencesView.as_view(), name="theme-preferences"),
]
#ENDPOINTS AUTH:
# /user/login/ - Login
# /user/logout/ - Logout
# /user/user/ - Dettagli utente
# /user/password/change/ - Cambia password
# /user/password/reset/ - Reset password (invia email)
# /user/password/reset/confirm/ - Conferma reset password
# /user/registration/ - Registrazione (se abilitata)
# /user/token/refresh/ - Refresh token JWT
    
"""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


#DEFINIZIONE -> /backend_snippets/api_authentication_file.py
#authentication_file

# DEFINIZIONE -> /backend_snippets/core/core_files.py

import os
from pathlib import Path

# DEFINIZIONE DEL CONTENUTO DEI FILE views.py, urls.py, authentication.py

def get_views_code():
    return '''from rest_framework.views import APIView #type: ignore
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

'''

def get_urls_code():
    return '''from django.urls import path #type: ignore
from .views import PublicKeyView

urlpatterns = [
    path('auth/public-key/', PublicKeyView.as_view(), name='public_key'),
]

'''

def get_authentication_code():
    return '''import os
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
    
'''

    
# CREAZIONE DELLA DIR E DEI FILE CON IL CONTENUTO DEFINITO SOPRA

def create_core_dir():
    """
    Controlla se la directory "core" esiste.
    Se non esiste, la crea e crea al suo interno i file.
    """
    
    backendDir = Path(__file__).parent
    dir_path = backendDir / "core"

    file_contents = {
        "views.py": get_views_code(),
        "urls.py": get_urls_code(),
        "authentication.py": get_authentication_code(),
    }
    
    if not os.path.exists(dir_path):
        try:
            os.makedirs(dir_path)
            print(f"La directory '{dir_path}' è stata creata con successo.")
            
            for file_name, content in file_contents.items():
                file_path = os.path.join(dir_path, file_name)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Il file '{file_name}' è stato creato in '{dir_path}'.")
        except OSError as e:
            print(f"Errore durante la creazione della directory o dei file: {e}")
    else:
        print(f"La directory '{dir_path}' esiste già.")



# DEFINIZIONE -> /backend_snippets/api_url_gateway/api_url_gateway.py
def generate_api_dir():
    api_dir_path = backendDir / "api" / "v1"

    api_dir_path.mkdir(parents=True, exist_ok=True)

    urls_path = api_dir_path / "urls.py"

    content = """ # Centralizzare qui tutti gli endpoint API v1
from django.urls import path, include

urlpatterns = [
    path('core/', include('core.urls')),  # Include the CORE dir URLs
    path('user/', include('user.urls')),  # Include the user management URLs
    path('dashboard/', include('dashboard.urls')),
]
    """
    with open(urls_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ File 'api/v1/urls.py' creato correttamente.")





#---------------INIZIO SETUP PROGETTO BACKEND----------------#
print("Creazione progetto Django...")

# === 1. startproject ===
if not (backendDir / "config").is_dir():
    run("django-admin startproject config .", cwd=backendDir)
    print("✅ Progetto Django creato nella directory 'config'")
else:
    print("ℹ️  Progetto già esistente. Skipping...")

# === 2. startapp user ===
if not (backendDir / "user").is_dir():
    run("python manage.py startapp user", cwd=backendDir)
    print("✅ App 'user' creata")
else:
    print("ℹ️  App 'user' già esistente. Skipping...")

# === 3. startapp dashboard ===
if not (backendDir / "dashboard").is_dir():
    run("python manage.py startapp dashboard", cwd=backendDir)
    print("✅ App 'dashboard' creata")
else:
    print("ℹ️  App 'dashboard' già esistente. Skipping...")

# Crea la cartella media se non esiste
media_dir = backendDir / "media" / "profile_images"
if not media_dir.exists():
    media_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ Cartella 'media/profile_images' creata in: {media_dir}")

#Creazione cartella template per reset email ------------------
template_dir = backendDir / "templates" / "registration"
if not template_dir.exists():
    template_dir.mkdir(parents=True, exist_ok=True)
    psw_reset_path = template_dir / "password_reset_email.html"
    psw_reset_content = r"""
Ciao {{ user.get_username }},

Hai richiesto di reimpostare la tua password. Clicca sul link sottostante per procedere:

{{ protocol }}://{{ domain }}/reset-password/confirm?uid={{ uid }}&token={{ token }}

Se non hai richiesto questa operazione, ignora questa email.

"""
    with open(psw_reset_path, "w", encoding="utf-8") as f:
        f.write(psw_reset_content)
        print(f"✅ File 'urls.py' creato in: {psw_reset_path}")
    print(f"✅ Cartella 'templates/registration' creata in: {template_dir}")

    
# ESECUZIONE -> /backend_snippets/api_app.py
#execute_api_code

# ESECUZIONE -> /backend_snippets/dashboard_app.py
dashboard_url_code()


# ESECUZIONE -> /backend_snippets/config_core.py
modify_main_urls()
    

# ESECUZIONE -> /backend_snippets/user_app.py
extend_user_model()
add_user_model_to_admin()
user_custom_serializer()


# ESECUZIONE -> /backend_snippets/user_preferences.py
user_preference_view()
user_preference_url()


# ESECUZIONE -> /backend_snippets/api_authentication_file.py
#execute_authentication

# ESECUZIONE -> /backend_snippets/core/core_files.py
create_core_dir()


# ESECUZIONE -> /backend_snippets/api_url_gateway/api_url_gateway.py
generate_api_dir()




# === 4. configure_backend.py ===
run("python configure_backend.py", cwd=backendDir)
print("✅ settings.py configurato correttamente.")

# === 5. Migrazioni iniziali ===
run ("python manage.py makemigrations", cwd=backendDir)
run ("python manage.py migrate", cwd=backendDir)

# === 6. Crea superuser ===
print("INSERISCI LE CREDENZIALI PER CREARE UN SUPERUSER:")
run ("python manage.py createsuperuser", cwd=backendDir)


print("🎉 Setup completato!")
