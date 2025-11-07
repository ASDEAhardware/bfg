from django.apps import AppConfig


class MqttConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mqtt'

    def ready(self):
        # Importa i segnali per registrarli
        import mqtt.signals