"""
Management command per controllare e marcare dispositivi offline.

Questo comando può essere eseguito:
1. Manualmente: python manage.py check_offline_devices
2. Via Cronjob: */5 * * * * python manage.py check_offline_devices (ogni 5 minuti)
3. Via Celery Beat: Periodic task

Serve come SAFETY NET ridondante rispetto al monitor thread.
"""
from django.core.management.base import BaseCommand
from mqtt.services.message_processor import message_processor
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Check and mark offline devices (Gateway, Datalogger, Sensor) based on heartbeat timeout'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each device checked',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually changing anything',
        )

    def handle(self, *args, **options):
        verbose = options.get('verbose', False)
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(
                self.style.WARNING('🔍 DRY RUN MODE - No changes will be made')
            )

        self.stdout.write('🔍 Checking offline devices...')

        try:
            if dry_run:
                # In dry-run, simula il check senza salvare
                stats = self._dry_run_check()
            else:
                # Esegui check reale
                stats = message_processor.check_offline_devices()

            # Output risultati
            self.stdout.write('')
            self.stdout.write('📊 RESULTS:')
            self.stdout.write(f'   Gateways checked: {stats["gateways_checked"]}')
            self.stdout.write(f'   Gateways marked offline: {stats["gateways_offline"]}')
            self.stdout.write(f'   Dataloggers checked: {stats["dataloggers_checked"]}')
            self.stdout.write(f'   Dataloggers marked offline: {stats["dataloggers_offline"]}')
            self.stdout.write(f'   Sensors checked: {stats["sensors_checked"]}')
            self.stdout.write(f'   Sensors marked offline: {stats["sensors_offline"]}')

            total_offline = (
                stats['gateways_offline'] +
                stats['dataloggers_offline'] +
                stats['sensors_offline']
            )

            if total_offline > 0:
                self.stdout.write(
                    self.style.WARNING(f'\n⚠️  {total_offline} devices marked offline')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS('\n✅ All devices are online')
                )

            # Verbose output
            if verbose and not dry_run:
                self._show_detailed_status()

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error during offline check: {e}')
            )
            raise

    def _dry_run_check(self):
        """Simula il check senza modificare il database."""
        from mqtt.models import Gateway, Datalogger, Sensor
        from django.utils import timezone

        now = timezone.now()
        stats = {
            'gateways_checked': 0,
            'gateways_offline': 0,
            'dataloggers_checked': 0,
            'dataloggers_offline': 0,
            'sensors_checked': 0,
            'sensors_offline': 0
        }

        # Check Gateways
        gateways = Gateway.objects.filter(
            is_online=True,
            expected_heartbeat_interval__isnull=False,
            last_seen_at__isnull=False
        )
        for gateway in gateways:
            stats['gateways_checked'] += 1
            timeout = gateway.expected_heartbeat_interval * 2.5
            elapsed = (now - gateway.last_seen_at).total_seconds()
            if elapsed > timeout:
                stats['gateways_offline'] += 1
                self.stdout.write(
                    f'   Would mark offline: Gateway {gateway.serial_number} '
                    f'(elapsed: {elapsed:.1f}s, timeout: {timeout:.1f}s)'
                )

        # Check Dataloggers
        dataloggers = Datalogger.objects.filter(
            is_online=True,
            expected_heartbeat_interval__isnull=False,
            last_seen_at__isnull=False
        )
        for dl in dataloggers:
            stats['dataloggers_checked'] += 1
            timeout = dl.expected_heartbeat_interval * 2.5
            elapsed = (now - dl.last_seen_at).total_seconds()
            if elapsed > timeout:
                stats['dataloggers_offline'] += 1
                self.stdout.write(
                    f'   Would mark offline: Datalogger {dl.serial_number} '
                    f'(elapsed: {elapsed:.1f}s, timeout: {timeout:.1f}s)'
                )

        # Check Sensors
        sensors = Sensor.objects.filter(
            is_online=True,
            expected_heartbeat_interval__isnull=False,
            last_seen_at__isnull=False
        )
        for sensor in sensors:
            stats['sensors_checked'] += 1
            timeout = sensor.expected_heartbeat_interval * 2.5
            elapsed = (now - sensor.last_seen_at).total_seconds()
            if elapsed > timeout:
                stats['sensors_offline'] += 1

        return stats

    def _show_detailed_status(self):
        """Mostra stato dettagliato di tutti i dispositivi."""
        from mqtt.models import Gateway, Datalogger, Sensor
        from django.utils import timezone

        now = timezone.now()

        self.stdout.write('\n📊 DETAILED STATUS:')

        # Gateways
        self.stdout.write('\n🌐 GATEWAYS:')
        for gw in Gateway.objects.all().order_by('serial_number'):
            if gw.last_seen_at:
                elapsed = (now - gw.last_seen_at).total_seconds()
                status = '🟢 ONLINE' if gw.is_online else '🔴 OFFLINE'
                self.stdout.write(
                    f'   {status} {gw.serial_number}: '
                    f'last_seen={elapsed:.0f}s ago, '
                    f'timeout={gw.expected_heartbeat_interval * 2.5:.0f}s'
                )
            else:
                self.stdout.write(f'   ⚪ NEVER {gw.serial_number}: No data received yet')

        # Dataloggers
        self.stdout.write('\n💾 DATALOGGERS:')
        for dl in Datalogger.objects.all().order_by('serial_number'):
            if dl.last_seen_at:
                elapsed = (now - dl.last_seen_at).total_seconds()
                status = '🟢 ONLINE' if dl.is_online else '🔴 OFFLINE'
                self.stdout.write(
                    f'   {status} {dl.serial_number}: '
                    f'last_seen={elapsed:.0f}s ago, '
                    f'timeout={dl.expected_heartbeat_interval * 2.5:.0f}s'
                )
            else:
                self.stdout.write(f'   ⚪ NEVER {dl.serial_number}: No data received yet')

        # Sensors (solo se presenti)
        sensor_count = Sensor.objects.count()
        if sensor_count > 0:
            self.stdout.write(f'\n🌡️  SENSORS ({sensor_count} total):')
            online = Sensor.objects.filter(is_online=True).count()
            offline = Sensor.objects.filter(is_online=False).count()
            self.stdout.write(f'   🟢 Online: {online}')
            self.stdout.write(f'   🔴 Offline: {offline}')
