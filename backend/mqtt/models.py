# mqtt/models.py

from django.db import models

class Device(models.Model):
    """Model for storing information about discovered devices."""
    serial_number = models.CharField(max_length=100, unique=True, primary_key=True, help_text="Device serial number")
    ip_address = models.GenericIPAddressField(protocol='both', unpack_ipv4=True, help_text="Device IP address")
    software_version = models.CharField(max_length=50, help_text="Device software version")
    last_seen = models.DateTimeField(auto_now=True, help_text="Time of last detection")

    def __str__(self):
        return f"{self.serial_number} ({self.ip_address})"

    class Meta:
        verbose_name = "Device"
        verbose_name_plural = "Devices"
        ordering = ['-last_seen']

class DataloggerStatus(models.Model):
    """Model for storing the last known status of the datalogger."""
    STATUS_CHOICES = [
        ('running', 'running'),
        ('stopped', 'stopped'),
        ('starting', 'starting'),
        ('error', 'error'),
        ('unknown', 'unknown'),
    ]
    
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='unknown')
    details = models.TextField(blank=True, null=True, help_text="Additional information or error message")
    timestamp = models.DateTimeField(auto_now=True, help_text="Time of last status update")

    def __str__(self):
        return f"Status: {self.get_status_display()} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    class Meta:
        verbose_name = "Datalogger status"
        verbose_name_plural = "Datalogger statuses"
        ordering = ['-timestamp']

class SubscriberStatus(models.Model):
    """Model for tracking MQTT subscriber connection status."""
    STATUS_CHOICES = [
        ('disconnected', 'Disconnected'),
        ('connecting', 'Connecting'),
        ('connected', 'Connected'),
        ('error', 'Error'),
    ]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='disconnected')
    last_heartbeat = models.DateTimeField(auto_now=True, help_text="Time of last heartbeat")
    error_message = models.TextField(blank=True, null=True, help_text="Last error message if any")
    process_id = models.IntegerField(null=True, blank=True, help_text="PID of the subscriber process")

    def __str__(self):
        return f"Subscriber: {self.get_status_display()}"

    class Meta:
        verbose_name = "Subscriber Status"
        verbose_name_plural = "Subscriber Statuses"
