from django.core.management.base import BaseCommand
from mqtt.models import DiscoveredTopic
from mqtt.services.mqtt_service import mqtt_service
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clean old retained MQTT messages from broker'

    def add_arguments(self, parser):
        parser.add_argument(
            '--site-id',
            type=int,
            help='Clean only for specific site ID'
        )
        parser.add_argument(
            '--topic-pattern',
            type=str,
            help='Clean only topics matching pattern (e.g., */connection/status)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned without actually cleaning'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Clean topics older than N days (default: 7)'
        )

    def handle(self, *args, **options):
        site_id = options.get('site_id')
        topic_pattern = options.get('topic_pattern')
        dry_run = options.get('dry_run', False)
        days = options.get('days', 7)

        self.stdout.write(f"Starting cleanup for topics older than {days} days...")

        # Get topics to clean
        topics_query = DiscoveredTopic.objects.all()

        if site_id:
            topics_query = topics_query.filter(site_id=site_id)

        if topic_pattern:
            # Convert glob pattern to Django filter
            pattern = topic_pattern.replace('*', '%')
            topics_query = topics_query.filter(topic_path__like=pattern)

        # Filter topics that are old
        cutoff = timezone.now() - timedelta(days=days)
        old_topics = topics_query.filter(last_seen_at__lt=cutoff)

        count = old_topics.count()
        self.stdout.write(f"Found {count} old topics to clean")

        if count == 0:
            return

        if dry_run:
            self.stdout.write("\n--- DRY RUN PREVIEW ---")
            for topic in old_topics:
                self.stdout.write(f"Would clean: {topic.topic_path} (Last seen: {topic.last_seen_at})")
            return

        # Clean each topic by publishing empty retained message
        cleaned_count = 0
        failed_count = 0

        self.stdout.write("\n--- CLEANING ---")
        for topic in old_topics:
            try:
                # Extract site_id from topic model
                site_id_target = topic.site_id
                if not site_id_target and topic.site:
                    site_id_target = topic.site.id
                
                if not site_id_target:
                    self.stdout.write(self.style.WARNING(f"Skipping {topic.topic_path}: No site ID found"))
                    continue

                # Publish empty retained message
                result = mqtt_service.publish_message(
                    site_id=site_id_target,
                    topic=topic.topic_path,
                    message='',  # Empty payload clears retained
                    qos=1,
                    retain=True
                )

                if result.get('success'):
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Cleaned: {topic.topic_path}")
                    )
                    cleaned_count += 1
                    
                    # Optionally update DiscoveredTopic to mark it as cleaned?
                    # Or delete it? For now just leave it.
                else:
                    self.stdout.write(
                        self.style.ERROR(f"✗ Failed: {topic.topic_path} - {result.get('error')}")
                    )
                    failed_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Error cleaning {topic.topic_path}: {e}")
                )
                failed_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nCleanup complete! Cleaned: {cleaned_count}, Failed: {failed_count}"
            )
        )
