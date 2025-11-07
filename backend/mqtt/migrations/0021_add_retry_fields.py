# Generated manually for mqtt refactor
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mqtt', '0020_remove_gateway_legacy_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='mqttconnection',
            name='mqtt_retry_count',
            field=models.IntegerField(default=0, help_text='Current retry attempt count'),
        ),
        migrations.AddField(
            model_name='mqttconnection',
            name='mqtt_next_retry',
            field=models.DateTimeField(blank=True, help_text='When to attempt next retry', null=True),
        ),
    ]
