
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
    