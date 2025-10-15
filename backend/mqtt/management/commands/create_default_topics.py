from django.core.management.base import BaseCommand
from mqtt.models import MqttConnection, MqttTopic


class Command(BaseCommand):
    help = 'Crea i topic MQTT default per tutte le connessioni esistenti'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Sovrascrive i topic esistenti',
        )

    def handle(self, *args, **options):
        overwrite = options['overwrite']

        # Topic default da creare per ogni connessione
        default_topics = [
            {
                'topic_pattern': 'datalogger_o/heartbeat',
                'qos_level': 0,
                'priority': 1,
                'description': 'Dati sensori in tempo reale (heartbeat)',
                'is_active': True
            },
            {
                'topic_pattern': 'sys_info',
                'qos_level': 0,
                'priority': 0,
                'description': 'Informazioni di sistema e stato',
                'is_active': False  # Non ancora implementato
            }
        ]

        connections = MqttConnection.objects.all()
        created_count = 0
        skipped_count = 0

        for conn in connections:
            self.stdout.write(f"Processing connection for site: {conn.site.name}")

            for topic_data in default_topics:
                topic_pattern = topic_data['topic_pattern']

                # Controlla se il topic esiste già
                existing_topic = MqttTopic.objects.filter(
                    mqtt_connection=conn,
                    topic_pattern=topic_pattern
                ).first()

                if existing_topic:
                    if overwrite:
                        # Aggiorna topic esistente
                        for key, value in topic_data.items():
                            if key != 'topic_pattern':
                                setattr(existing_topic, key, value)
                        existing_topic.save()
                        self.stdout.write(
                            self.style.WARNING(f"  Updated: {existing_topic.get_full_topic()}")
                        )
                        created_count += 1
                    else:
                        self.stdout.write(
                            self.style.WARNING(f"  Skipped: {existing_topic.get_full_topic()} (already exists)")
                        )
                        skipped_count += 1
                else:
                    # Crea nuovo topic
                    topic = MqttTopic.objects.create(
                        mqtt_connection=conn,
                        **topic_data
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"  Created: {topic.get_full_topic()}")
                    )
                    created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nCompleted! Created/Updated: {created_count}, Skipped: {skipped_count}"
            )
        )