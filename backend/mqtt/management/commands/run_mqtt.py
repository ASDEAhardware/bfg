import time
import signal
import sys
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from mqtt.services.mqtt_manager import MqttClientManager

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run MQTT client manager for all configured sites'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.manager = None
        self.running = False

    def add_arguments(self, parser):
        parser.add_argument(
            '--health-check-interval',
            type=int,
            default=30,
            help='Health check interval in seconds (default: 30)'
        )
        parser.add_argument(
            '--log-level',
            type=str,
            default='INFO',
            choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
            help='Log level (default: INFO)'
        )

    def handle(self, *args, **options):
        # Configura logging
        log_level = getattr(logging, options['log_level'])
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        health_check_interval = options['health_check_interval']

        self.stdout.write(
            self.style.SUCCESS('Starting MQTT Client Manager...')
        )

        # Crea manager
        self.manager = MqttClientManager()

        # Setup signal handlers per shutdown graceful
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        try:
            # Avvia tutte le connessioni
            self.manager.start_all_connections()
            self.running = True

            self.stdout.write(
                self.style.SUCCESS('MQTT Manager started successfully')
            )

            # Loop principale
            last_health_check = 0
            while self.running:
                current_time = time.time()

                # Health check periodico
                if current_time - last_health_check >= health_check_interval:
                    try:
                        self.manager.health_check()
                        status = self.manager.get_connection_status()

                        self.stdout.write(
                            f"Health check - "
                            f"Active: {status['active_clients']}/{status['total_configured']}, "
                            f"Connected: {status['connected']}, "
                            f"Errors: {status['errors']}"
                        )

                        last_health_check = current_time

                    except Exception as e:
                        self.stderr.write(
                            self.style.ERROR(f'Health check error: {e}')
                        )

                # Sleep per evitare uso eccessivo CPU
                time.sleep(1)

        except KeyboardInterrupt:
            self.stdout.write('Received interrupt signal...')
        except Exception as e:
            self.stderr.write(
                self.style.ERROR(f'Unexpected error: {e}')
            )
            logger.exception("Unexpected error in MQTT manager")
        finally:
            self._shutdown()

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.stdout.write(f'Received signal {signum}, shutting down...')
        self.running = False

    def _shutdown(self):
        """Graceful shutdown"""
        self.stdout.write('Shutting down MQTT Manager...')

        if self.manager:
            try:
                self.manager.stop_all_connections()
                self.stdout.write(
                    self.style.SUCCESS('MQTT Manager stopped successfully')
                )
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f'Error during shutdown: {e}')
                )

        sys.exit(0)