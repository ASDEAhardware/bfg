from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class MqttConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mqtt'

    def ready(self):
        """Avvia il servizio MQTT quando Django si carica"""
        # Evita di avviare durante migrations o collectstatic
        import sys
        if 'migrate' in sys.argv or 'collectstatic' in sys.argv or 'makemigrations' in sys.argv:
            return

        # Avvia il manager MQTT in background
        try:
            from .services.mqtt_manager import MqttClientManager
            from django.core.cache import cache
            import threading
            import time

            def start_mqtt_service():
                # Aspetta che Django sia completamente caricato
                time.sleep(3)

                # Controlla se già avviato (per evitare duplicati in reload)
                if cache.get('mqtt_manager_started'):
                    logger.info("MQTT Manager already started, skipping")
                    return

                logger.info("Starting MQTT Client Manager from Django AppConfig...")

                try:
                    # USA IL SINGLETON invece di creare nuova istanza
                    manager = MqttClientManager.get_instance()
                    manager.start_all_connections()

                    # Segna come avviato
                    cache.set('mqtt_manager_started', True, timeout=None)

                    logger.info("MQTT Client Manager (singleton) started successfully")

                    # Mantieni il thread attivo per health checks
                    while True:
                        time.sleep(30)  # Health check ogni 30 secondi
                        try:
                            manager.health_check()
                        except Exception as e:
                            logger.error(f"MQTT health check error: {e}")

                except Exception as e:
                    logger.error(f"Failed to start MQTT Manager: {e}")

            # Avvia in thread daemon separato
            mqtt_thread = threading.Thread(target=start_mqtt_service, daemon=True)
            mqtt_thread.start()

            logger.info("MQTT service thread started")

        except Exception as e:
            logger.error(f"Error starting MQTT service: {e}")
