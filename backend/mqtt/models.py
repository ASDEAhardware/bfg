from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator


class MqttConnection(models.Model):
    """
    Configurazione connessione MQTT per ogni sito
    """
    STATUS_CHOICES = [
        ('disconnected', 'Disconnected'),
        ('connecting', 'Connecting'),
        ('connected', 'Connected'),
        ('error', 'Error'),
        ('disabled', 'Disabled')
    ]

    site = models.OneToOneField('sites.Site', on_delete=models.CASCADE)

    # Connection settings
    broker_host = models.CharField(max_length=255)
    broker_port = models.IntegerField(default=1883)
    username = models.CharField(max_length=100, blank=True)
    password = models.CharField(max_length=100, blank=True)
    client_id_prefix = models.CharField(
        max_length=50,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_/-]+$',
                message='Client ID prefix può contenere solo lettere, numeri, underscore, slash e trattini'
            )
        ],
        help_text="Prefisso per client ID e topic MQTT (es: 'sito_001', 'company/site_a')"
    )

    # Retry settings
    keep_alive_interval = models.IntegerField(default=60)  # secondi
    retry_attempts = models.IntegerField(default=5)
    retry_delay = models.IntegerField(default=5)  # secondi
    max_retry_delay = models.IntegerField(default=300)  # 5 min max

    # SSL settings
    ssl_enabled = models.BooleanField(default=False)
    ca_cert_path = models.CharField(max_length=500, blank=True)

    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='disconnected')
    last_connected_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    connection_errors = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "MQTT Connection"
        verbose_name_plural = "MQTT Connections"

    def __str__(self):
        return f"MQTT {self.site.name} - {self.broker_host}"


class SensorDevice(models.Model):
    """
    Registro di tutti i sensori per ogni sito
    """
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE)
    device_name = models.CharField(max_length=100)  # es: "MNA00542"

    # Metadata
    device_type = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    # Status tracking
    last_seen_at = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    consecutive_misses = models.IntegerField(default=0)

    # Stats per benchmark
    total_messages = models.IntegerField(default=0)
    uptime_percentage = models.FloatField(default=100.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('site', 'device_name')
        verbose_name = "Sensor Device"
        verbose_name_plural = "Sensor Devices"
        ordering = ['site', 'device_name']

    def __str__(self):
        return f"{self.device_name} ({self.site.name})"


class SensorData(models.Model):
    """
    Dati dei sensori (rolling 3 record per sensore)
    """
    sensor_device = models.ForeignKey(SensorDevice, on_delete=models.CASCADE)

    # Raw data dal JSON
    timestamp = models.DateTimeField()  # dal campo "ts"
    raw_data = models.JSONField()  # tutto il payload del sensore

    # Parsed common fields
    acc_x = models.FloatField(null=True, blank=True)
    acc_y = models.FloatField(null=True, blank=True)
    acc_z = models.FloatField(null=True, blank=True)
    incli_x = models.FloatField(null=True, blank=True)
    incli_y = models.FloatField(null=True, blank=True)

    # Optional fields (solo per alcuni sensori)
    mag_x = models.FloatField(null=True, blank=True)
    mag_y = models.FloatField(null=True, blank=True)
    mag_z = models.FloatField(null=True, blank=True)
    gyro_x = models.FloatField(null=True, blank=True)
    gyro_y = models.FloatField(null=True, blank=True)
    gyro_z = models.FloatField(null=True, blank=True)

    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_device', '-timestamp']),
        ]
        verbose_name = "Sensor Data"
        verbose_name_plural = "Sensor Data"

    def __str__(self):
        return f"{self.sensor_device.device_name} - {self.timestamp}"


class MqttTopic(models.Model):
    """
    Topic MQTT configurabili per ogni connessione
    """
    QOS_CHOICES = [
        (0, 'QoS 0 - Fire and Forget'),
        (1, 'QoS 1 - At Least Once'),
        (2, 'QoS 2 - Exactly Once')
    ]

    mqtt_connection = models.ForeignKey(
        MqttConnection,
        on_delete=models.CASCADE,
        related_name='topics'
    )
    topic_pattern = models.CharField(
        max_length=255,
        help_text="Pattern topic senza prefisso (es: 'datalogger_o/heartbeat', 'alerts', 'config/response')"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Se il topic è attivo per la subscription"
    )
    qos_level = models.IntegerField(
        default=0,
        choices=QOS_CHOICES,
        help_text="Quality of Service level per questo topic"
    )
    description = models.TextField(
        blank=True,
        help_text="Descrizione del topic e del suo utilizzo"
    )

    # Settaggi futuri estendibili
    auto_retry = models.BooleanField(
        default=True,
        help_text="Riprova automaticamente subscription se fallisce"
    )
    priority = models.IntegerField(
        default=0,
        help_text="Priorità topic (0=normale, 1=alta, -1=bassa)"
    )
    max_message_size = models.IntegerField(
        null=True, blank=True,
        help_text="Dimensione massima messaggio in bytes (null=illimitato)"
    )

    # Statistiche subscription (future enhancement)
    subscription_count = models.IntegerField(
        default=0,
        help_text="Numero totale di subscription effettuate"
    )
    last_subscribed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Ultima subscription riuscita"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('mqtt_connection', 'topic_pattern')
        ordering = ['priority', 'topic_pattern']
        verbose_name = "MQTT Topic"
        verbose_name_plural = "MQTT Topics"
        indexes = [
            models.Index(fields=['mqtt_connection', 'is_active']),
            models.Index(fields=['topic_pattern']),
        ]

    def get_full_topic(self):
        """Ritorna topic completo con prefix configurabile"""
        prefix = self.mqtt_connection.client_id_prefix
        return f"{prefix}/{self.topic_pattern}"

    def __str__(self):
        status = "✅" if self.is_active else "❌"
        return f"{status} {self.get_full_topic()} (QoS {self.qos_level})"


class ConnectionLog(models.Model):
    """
    Log eventi connessione MQTT per benchmark continuità
    """
    EVENT_CHOICES = [
        ('connected', 'Connected'),
        ('disconnected', 'Disconnected'),
        ('heartbeat_missed', 'Heartbeat Missed'),
        ('error', 'Error')
    ]

    mqtt_connection = models.ForeignKey(MqttConnection, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    message = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Connection Log"
        verbose_name_plural = "Connection Logs"

    def __str__(self):
        return f"{self.mqtt_connection.site.name} - {self.event_type} - {self.timestamp}"