# Generated manually for app rename from mqtt_control to mqtt
# This migration is applied with --fake since the tables already exist with correct names

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('mqtt', '0001_initial'),
    ]

    operations = [
        # No operations needed - tables already exist with correct names
        # This migration is just to mark the rename as completed
    ]