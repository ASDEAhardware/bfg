"""
Django Management Command per avviare il servizio MQTT permanente
"""
import logging
import signal
import sys
import time
from django.core.management.base import BaseCommand

from mqtt.services.mqtt_service import mqtt_service

# Configura logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Management command per il servizio MQTT permanente.

    Utilizzo:
        python manage.py start_mqtt_service                # Avvia servizio
        python manage.py start_mqtt_service --status        # Mostra stato
        python manage.py start_mqtt_service --log-level DEBUG  # Avvia con debug
    """

    help = 'Avvia il servizio MQTT permanente per gestire tutte le connessioni'

    def add_arguments(self, parser):
        parser.add_argument(
            '--status',
            action='store_true',
            help='Mostra stato del servizio MQTT',
        )
        parser.add_argument(
            '--log-level',
            choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
            default='INFO',
            help='Livello di logging',
        )

    def handle(self, *args, **options):
        """Entry point del comando"""

        # Configura livello logging
        log_level = getattr(logging, options['log_level'])
        logging.getLogger().setLevel(log_level)
        logging.getLogger('mqtt').setLevel(log_level)

        try:
            if options['status']:
                self._show_status()
            else:
                self._start_service()

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nReceived interrupt signal. Stopping...'))
            self._stop_service()
        except Exception as e:
            logger.error(f"Fatal error in MQTT service: {e}", exc_info=True)
            self.stdout.write(self.style.ERROR(f"Service error: {e}"))
            sys.exit(1)

    def _start_service(self):
        """Avvia il servizio MQTT"""
        self.stdout.write(self.style.SUCCESS('🚀 Starting MQTT Service...'))

        logger.info("=" * 60)
        logger.info("MQTT SERVICE STARTING")
        logger.info("=" * 60)

        # Configura signal handlers per shutdown pulito
        self._setup_signal_handlers()

        # Avvia service
        success = mqtt_service.start()

        if not success:
            self.stdout.write(self.style.ERROR('❌ Failed to start MQTT Service'))
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS('✅ MQTT Service started successfully'))
        logger.info("MQTT Service is now running...")

        # Mantieni servizio attivo
        self._keep_alive()

    def _stop_service(self):
        """Ferma il servizio MQTT"""
        self.stdout.write(self.style.WARNING('🛑 Stopping MQTT Service...'))
        logger.info("MQTT SERVICE STOPPING")

        if mqtt_service.is_running():
            success = mqtt_service.stop()
            if success:
                self.stdout.write(self.style.SUCCESS('✅ MQTT Service stopped successfully'))
                logger.info("MQTT Service stopped")
            else:
                self.stdout.write(self.style.ERROR('❌ Error stopping MQTT Service'))
                logger.error("Error stopping MQTT Service")
        else:
            self.stdout.write(self.style.WARNING('⚠️  MQTT Service is not running'))
            logger.warning("MQTT Service was not running")

    def _show_status(self):
        """Mostra stato dettagliato del servizio"""
        self.stdout.write(self.style.HTTP_INFO('MQTT Service Status'))
        self.stdout.write('=' * 60)

        # Stato manager
        is_running = mqtt_service.is_running()
        status_color = self.style.SUCCESS if is_running else self.style.ERROR
        status_text = "🟢 RUNNING" if is_running else "🔴 STOPPED"

        self.stdout.write(f"Manager Status: {status_color(status_text)}")

        if is_running:
            # Stato connessioni
            connections = mqtt_service.get_all_connections_status()
            self.stdout.write(f"Total Connections: {len(connections)}")

            # Raggruppa per stato
            status_counts = {}
            for conn in connections:
                status = conn.get('status', 'unknown')
                status_counts[status] = status_counts.get(status, 0) + 1

            self.stdout.write("\nConnections by Status:")
            for status, count in status_counts.items():
                status_icon = {
                    'connected': '🟢',
                    'connecting': '🟡',
                    'disconnected': '🔴',
                    'error': '❌',
                    'disabled': '⚪'
                }.get(status, '❓')
                self.stdout.write(f"  {status_icon} {status.upper()}: {count}")

            # Dettaglio connessioni attive (solo se poche)
            if len(connections) <= 10:
                self.stdout.write("\nActive Connections:")
                for conn in connections:
                    if conn.get('is_active'):
                        site_name = conn.get('site_name', 'Unknown')
                        status = conn.get('status', 'unknown')
                        is_connected = conn.get('handler_connected', False)

                        conn_icon = '🟢' if is_connected else '🔴'
                        self.stdout.write(f"  {conn_icon} {site_name} ({status})")

        else:
            self.stdout.write("\nService is not running. Start it with:")
            self.stdout.write("  python manage.py start_mqtt_service")

        self.stdout.write('=' * 60)

    def _setup_signal_handlers(self):
        """Configura signal handlers per shutdown pulito"""
        def signal_handler(signum, frame):
            signal_name = signal.Signals(signum).name
            logger.info(f"Received signal {signal_name} - shutting down gracefully")
            self._stop_service()
            sys.exit(0)

        # Registra handlers per SIGTERM e SIGINT
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        logger.info("Signal handlers configured for graceful shutdown")

    def _keep_alive(self):
        """Mantiene il servizio attivo fino a signal di stop"""
        self.stdout.write("🔄 MQTT Service running... (Press Ctrl+C to stop)")

        try:
            # Loop principale - controlla ogni 5 secondi che il manager sia vivo
            while mqtt_service.is_running():
                time.sleep(5)

                # Heartbeat log ogni 5 minuti
                if int(time.time()) % 300 == 0:
                    connections_count = len(mqtt_service.get_all_connections_status())
                    logger.info(f"MQTT Service heartbeat - {connections_count} connections managed")

        except KeyboardInterrupt:
            # Gestito da signal handler
            pass
        except Exception as e:
            logger.error(f"Error in keep_alive loop: {e}", exc_info=True)
            raise

        logger.info("MQTT Service keep_alive loop ended")
