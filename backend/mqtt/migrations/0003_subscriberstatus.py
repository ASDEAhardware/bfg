# Generated manually for SubscriberStatus model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mqtt', '0002_rename_app'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubscriberStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('disconnected', 'Disconnected'), ('connecting', 'Connecting'), ('connected', 'Connected'), ('error', 'Error')], default='disconnected', max_length=20)),
                ('last_heartbeat', models.DateTimeField(auto_now=True, help_text='Time of last heartbeat')),
                ('error_message', models.TextField(blank=True, help_text='Last error message if any', null=True)),
                ('process_id', models.IntegerField(blank=True, help_text='PID of the subscriber process', null=True)),
            ],
            options={
                'verbose_name': 'Subscriber Status',
                'verbose_name_plural': 'Subscriber Statuses',
            },
        ),
    ]