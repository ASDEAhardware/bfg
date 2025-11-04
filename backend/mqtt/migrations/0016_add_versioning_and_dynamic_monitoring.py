# Generated migration for MQTT API versioning and dynamic offline monitoring

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mqtt', '0015_datalogger_gateway'),
        ('sites', '0001_initial'),
    ]

    operations = [
        # Add versioning fields to existing models
        migrations.AddField(
            model_name='gateway',
            name='mqtt_api_version',
            field=models.CharField(default='v1.0.0', max_length=20, help_text='MQTT API version used by this gateway'),
        ),
        migrations.AddField(
            model_name='datalogger',
            name='mqtt_api_version',
            field=models.CharField(default='v1.0.0', max_length=20, help_text='MQTT API version used by this datalogger'),
        ),
        migrations.AddField(
            model_name='sensor',
            name='mqtt_api_version',
            field=models.CharField(default='v1.0.0', max_length=20, help_text='MQTT API version used by this sensor'),
        ),

        # Add dynamic monitoring fields to Gateway
        migrations.AddField(
            model_name='gateway',
            name='connection_status',
            field=models.CharField(
                choices=[
                    ('online', 'Online'),
                    ('warning', 'Warning'),
                    ('offline', 'Offline'),
                    ('unknown', 'Unknown')
                ],
                default='online',
                max_length=20,
                help_text='Current connection status'
            ),
        ),
        migrations.AddField(
            model_name='gateway',
            name='expected_heartbeat_interval',
            field=models.IntegerField(default=60, help_text='Expected heartbeat interval in seconds'),
        ),
        migrations.AddField(
            model_name='gateway',
            name='last_status_change',
            field=models.DateTimeField(null=True, blank=True, help_text='When status last changed'),
        ),
        migrations.AddField(
            model_name='gateway',
            name='last_offline_at',
            field=models.DateTimeField(null=True, blank=True, help_text='When device went offline'),
        ),

        # Add dynamic monitoring fields to Datalogger
        migrations.AddField(
            model_name='datalogger',
            name='connection_status',
            field=models.CharField(
                choices=[
                    ('online', 'Online'),
                    ('warning', 'Warning'),
                    ('offline', 'Offline'),
                    ('gateway_offline', 'Gateway Offline'),
                    ('unknown', 'Unknown')
                ],
                default='online',
                max_length=20,
                help_text='Current connection status'
            ),
        ),
        migrations.AddField(
            model_name='datalogger',
            name='expected_heartbeat_interval',
            field=models.IntegerField(default=60, help_text='Expected heartbeat interval in seconds'),
        ),
        migrations.AddField(
            model_name='datalogger',
            name='last_status_change',
            field=models.DateTimeField(null=True, blank=True, help_text='When status last changed'),
        ),
        migrations.AddField(
            model_name='datalogger',
            name='last_offline_at',
            field=models.DateTimeField(null=True, blank=True, help_text='When device went offline'),
        ),

        # Add dynamic monitoring fields to Sensor
        migrations.AddField(
            model_name='sensor',
            name='connection_status',
            field=models.CharField(
                choices=[
                    ('online', 'Online'),
                    ('warning', 'Warning'),
                    ('offline', 'Offline'),
                    ('datalogger_offline', 'Datalogger Offline'),
                    ('gateway_offline', 'Gateway Offline'),
                    ('unknown', 'Unknown')
                ],
                default='online',
                max_length=20,
                help_text='Current connection status'
            ),
        ),
        migrations.AddField(
            model_name='sensor',
            name='expected_heartbeat_interval',
            field=models.IntegerField(default=60, help_text='Expected heartbeat interval in seconds'),
        ),
        migrations.AddField(
            model_name='sensor',
            name='last_status_change',
            field=models.DateTimeField(null=True, blank=True, help_text='When status last changed'),
        ),
        migrations.AddField(
            model_name='sensor',
            name='last_offline_at',
            field=models.DateTimeField(null=True, blank=True, help_text='When device went offline'),
        ),

        # Create MQTT API Version Usage tracking table
        migrations.CreateModel(
            name='MqttApiVersionUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version', models.CharField(max_length=20, help_text='MQTT API version')),
                ('topic_pattern', models.CharField(max_length=255, help_text='Topic pattern')),
                ('message_count', models.IntegerField(default=1, help_text='Number of messages received')),
                ('device_count', models.IntegerField(default=1, help_text='Number of unique devices')),
                ('first_seen_at', models.DateTimeField(auto_now_add=True)),
                ('last_seen_at', models.DateTimeField(auto_now=True)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mqtt_version_usage', to='sites.site')),
            ],
            options={
                'verbose_name': 'MQTT API Version Usage',
                'verbose_name_plural': 'MQTT API Version Usage',
                'ordering': ['-last_seen_at'],
            },
        ),

        # Create Downtime Events tracking table
        migrations.CreateModel(
            name='MqttDowntimeEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(max_length=255, help_text='Device serial number')),
                ('device_type', models.CharField(
                    choices=[
                        ('gateway', 'Gateway'),
                        ('datalogger', 'Datalogger'),
                        ('sensor', 'Sensor')
                    ],
                    max_length=50,
                    help_text='Type of device'
                )),
                ('offline_at', models.DateTimeField(help_text='When device went offline')),
                ('online_at', models.DateTimeField(null=True, blank=True, help_text='When device came back online')),
                ('downtime_seconds', models.IntegerField(null=True, blank=True, help_text='Total downtime in seconds')),
                ('expected_interval_seconds', models.IntegerField(help_text='Expected heartbeat interval')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('site', models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.CASCADE, related_name='mqtt_downtime_events', to='sites.site')),
            ],
            options={
                'verbose_name': 'MQTT Downtime Event',
                'verbose_name_plural': 'MQTT Downtime Events',
                'ordering': ['-offline_at'],
            },
        ),

        # Add indexes for performance
        migrations.AddIndex(
            model_name='mqttapiversionusage',
            index=models.Index(fields=['version', 'site'], name='mqtt_version_site_idx'),
        ),
        migrations.AddIndex(
            model_name='mqttapiversionusage',
            index=models.Index(fields=['topic_pattern'], name='mqtt_version_topic_idx'),
        ),
        migrations.AddIndex(
            model_name='mqttdowntimeevent',
            index=models.Index(fields=['device_id', 'device_type'], name='mqtt_downtime_device_idx'),
        ),
        migrations.AddIndex(
            model_name='mqttdowntimeevent',
            index=models.Index(fields=['site'], name='mqtt_downtime_site_idx'),
        ),
        migrations.AddIndex(
            model_name='mqttdowntimeevent',
            index=models.Index(fields=['offline_at', 'online_at'], name='mqtt_downtime_timeline_idx'),
        ),

        # Add unique constraints
        migrations.AddConstraint(
            model_name='mqttapiversionusage',
            constraint=models.UniqueConstraint(
                fields=['version', 'topic_pattern', 'site'],
                name='unique_version_topic_site'
            ),
        ),
    ]