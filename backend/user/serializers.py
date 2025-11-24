from dj_rest_auth.serializers import UserDetailsSerializer #type: ignore
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer #type: ignore
from rest_framework import serializers #type: ignore
from .models import UserPreferences

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['theme', 'show_resize_handle', 'accelerometer_unit', 'inclinometer_unit']

class ResizeHandlePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['show_resize_handle']

class AccelerometerUnitPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['accelerometer_unit']

class InclinometerUnitPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['inclinometer_unit']

class CustomUserDetailsSerializer(UserDetailsSerializer):
    userpreferences = UserPreferencesSerializer(read_only=True)

    class Meta(UserDetailsSerializer.Meta):
        fields = UserDetailsSerializer.Meta.fields + ('is_staff', 'is_superuser', 'profile_image', 'userpreferences')

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Aggiungi i dati personalizzati al payload del token
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        
        return token