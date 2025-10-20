from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError


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

    # Connection control
    is_enabled = models.BooleanField(
        default=True,
        help_text="Se disabilitata, questa connessione MQTT viene ignorata dal sistema"
    )

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
        status_icon = "✅" if self.is_enabled else "❌"
        return f"{status_icon} MQTT {self.site.name} - {self.broker_host}"



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


# ============================================================================
# NUOVI MODELLI PER AUTO-DISCOVERY MQTT - REFACTORING
# ============================================================================

class Gateway(models.Model):
    """
    Gateway/Sistema principale del sito (evoluzione di SystemInfo)
    Gestisce informazioni sistema generale ricevute via gateway/heartbeat
    """
    site = models.OneToOneField('sites.Site', on_delete=models.CASCADE, related_name='gateway')
    serial_number = models.CharField(
        max_length=100,
        unique=True,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_-]+$',
                message='Serial number può contenere solo lettere, numeri, underscore e trattini'
            )
        ]
    )
    label = models.CharField(
        max_length=255,
        help_text="Nome editabile dall'utente, default=serial_number",
        validators=[
            RegexValidator(
                regex=r'^[^<>\"\'&]+$',
                message='Label non può contenere caratteri HTML pericolosi'
            )
        ]
    )

    # System info
    hostname = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    firmware_version = models.CharField(max_length=50, blank=True)

    # Status tracking
    is_online = models.BooleanField(default=False)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    last_communication = models.DateTimeField(null=True, blank=True)

    # Performance metrics
    cpu_usage_percent = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    memory_usage_percent = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    disk_usage_percent = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    uptime_seconds = models.BigIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0)]
    )

    # Raw MQTT payload for debugging
    raw_metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Gateway"
        verbose_name_plural = "Gateways"
        ordering = ['site__name']

    def __str__(self):
        return f"{self.label} ({self.site.name})"

    def clean(self):
        super().clean()
        # Validazioni custom per Gateway
        if self.cpu_usage_percent is not None and self.cpu_usage_percent < 0:
            raise ValidationError("CPU usage cannot be negative")
        if self.memory_usage_percent is not None and self.memory_usage_percent < 0:
            raise ValidationError("Memory usage cannot be negative")
        if self.disk_usage_percent is not None and self.disk_usage_percent < 0:
            raise ValidationError("Disk usage cannot be negative")

    def save(self, *args, **kwargs):
        # Default label = serial_number se non specificato
        if not self.label and self.serial_number:
            self.label = self.serial_number
        self.full_clean()  # Chiama clean() e validatori
        super().save(*args, **kwargs)


class Datalogger(models.Model):
    """
    Datalogger auto-discovered via MQTT heartbeat
    Ogni datalogger ha serial_number univoco + label editabile
    """
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE, related_name='mqtt_dataloggers')
    serial_number = models.CharField(
        max_length=100,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_-]+$',
                message='Serial number può contenere solo lettere, numeri, underscore e trattini'
            )
        ]
    )
    label = models.CharField(
        max_length=255,
        help_text="Nome editabile dall'utente, default=serial_number",
        validators=[
            RegexValidator(
                regex=r'^[^<>\"\'&]+$',
                message='Label non può contenere caratteri HTML pericolosi'
            )
        ]
    )

    # Auto-discovery info dal topic ENHANCED (Fase 3)
    datalogger_type = models.CharField(max_length=50, blank=True, help_text="monstro, adaq, etc. - dal topic")
    device_id = models.CharField(max_length=50, blank=True, help_text="Device ID dal topic (1, 2, 3...)")
    instance_number = models.PositiveIntegerField(blank=True, null=True, help_text="LEGACY: Numero istanza dal topic (1, 2, 3...)")

    # Status e comunicazione ENHANCED (Fase 3)
    is_online = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(null=True, blank=True, help_text="Ultimo heartbeat ricevuto (ENHANCED)")
    last_heartbeat = models.DateTimeField(null=True, blank=True, help_text="LEGACY: compatibilità")
    last_communication = models.DateTimeField(null=True, blank=True, help_text="LEGACY: compatibilità")

    # Metadata dal payload
    firmware_version = models.CharField(max_length=50, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    raw_metadata = models.JSONField(default=dict, blank=True)

    # Statistiche per benchmark continuità servizio
    total_heartbeats = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    missed_heartbeats = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    uptime_percentage = models.FloatField(
        default=100.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    last_downtime_start = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('site', 'serial_number')
        indexes = [
            models.Index(fields=['site', 'datalogger_type', 'instance_number']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_online']),
            models.Index(fields=['last_heartbeat']),
        ]
        verbose_name = "Datalogger"
        verbose_name_plural = "Dataloggers"
        ordering = ['site__name', 'datalogger_type', 'instance_number']

    def __str__(self):
        # Enhanced __str__ method per nuova logica
        if self.datalogger_type and self.device_id:
            return f"{self.datalogger_type}/{self.device_id} ({self.serial_number})"
        elif self.datalogger_type and self.instance_number:
            # Fallback per legacy data
            return f"{self.datalogger_type}/{self.instance_number} ({self.serial_number})"
        else:
            return self.serial_number

    def clean(self):
        super().clean()
        # Validazione custom
        if self.missed_heartbeats > self.total_heartbeats:
            raise ValidationError("Missed heartbeats cannot exceed total heartbeats")

        # Ricalcola uptime percentage se necessario
        if self.total_heartbeats > 0:
            calculated_uptime = ((self.total_heartbeats - self.missed_heartbeats) / self.total_heartbeats) * 100
            if abs(self.uptime_percentage - calculated_uptime) > 1.0:  # Tolleranza 1%
                self.uptime_percentage = calculated_uptime

    def save(self, *args, **kwargs):
        # Default label = serial_number se non specificato
        if not self.label and self.serial_number:
            self.label = self.serial_number
        self.full_clean()  # Chiama clean() e validatori
        super().save(*args, **kwargs)


class Sensor(models.Model):
    """
    Sensori auto-discovered con dati near real-time integrati
    Ogni sensore ha serial_number + label editabile + ultimi 3 dati + statistiche
    """
    datalogger = models.ForeignKey(Datalogger, on_delete=models.CASCADE, related_name='sensors')
    serial_number = models.CharField(
        max_length=100,
        help_text="device_name dal payload",
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_.-]+$',
                message='Serial number può contenere solo lettere, numeri, underscore, punti e trattini'
            )
        ]
    )
    label = models.CharField(
        max_length=255,
        help_text="Nome editabile dall'utente, default=serial_number",
        validators=[
            RegexValidator(
                regex=r'^[^<>\"\'&]+$',
                message='Label non può contenere caratteri HTML pericolosi'
            )
        ]
    )

    # Metadata sensore
    sensor_type = models.CharField(max_length=50, blank=True)
    unit_of_measure = models.CharField(max_length=50, blank=True)

    # Status tracking
    is_online = models.BooleanField(default=False)
    last_reading = models.DateTimeField(null=True, blank=True)

    # === DATI NEAR REAL-TIME (ultimi 3 valori) ===
    # Ultimo dato (più recente)
    last_timestamp_1 = models.DateTimeField(null=True, blank=True)
    last_data_1 = models.JSONField(default=dict, blank=True)

    # Penultimo dato
    last_timestamp_2 = models.DateTimeField(null=True, blank=True)
    last_data_2 = models.JSONField(default=dict, blank=True)

    # Terzultimo dato
    last_timestamp_3 = models.DateTimeField(null=True, blank=True)
    last_data_3 = models.JSONField(default=dict, blank=True)

    # === STATISTICHE AGGREGATE ===
    # Contatori
    total_messages = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    total_readings = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )

    # Valori min/max da sempre registrati
    min_value_ever = models.FloatField(null=True, blank=True)
    max_value_ever = models.FloatField(null=True, blank=True)
    min_recorded_at = models.DateTimeField(null=True, blank=True)
    max_recorded_at = models.DateTimeField(null=True, blank=True)

    # Periodo di attività
    first_seen_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    # Benchmark qualità comunicazione
    uptime_percentage = models.FloatField(
        default=100.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)]
    )
    consecutive_misses = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('datalogger', 'serial_number')
        indexes = [
            models.Index(fields=['datalogger', 'is_online']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['last_reading']),
            models.Index(fields=['last_timestamp_1']),
        ]
        verbose_name = "Sensor"
        verbose_name_plural = "Sensors"
        ordering = ['datalogger__site__name', 'datalogger__label', 'label']

    def __str__(self):
        return f"{self.label} ({self.datalogger.label} - {self.datalogger.site.name})"

    def clean(self):
        super().clean()
        # Validazioni custom
        if self.total_readings > self.total_messages:
            raise ValidationError("Total readings cannot exceed total messages")

        if self.min_value_ever is not None and self.max_value_ever is not None:
            if self.min_value_ever > self.max_value_ever:
                raise ValidationError("Min value cannot be greater than max value")

        # Validazione coerenza timestamp
        timestamps = [
            self.last_timestamp_1,
            self.last_timestamp_2,
            self.last_timestamp_3
        ]
        valid_timestamps = [ts for ts in timestamps if ts is not None]

        if len(valid_timestamps) > 1:
            # I timestamp devono essere in ordine decrescente (più recente primo)
            for i in range(len(valid_timestamps) - 1):
                if valid_timestamps[i] < valid_timestamps[i + 1]:
                    raise ValidationError("Timestamp readings must be in descending order")

    def save(self, *args, **kwargs):
        # Default label = serial_number se non specificato
        if not self.label and self.serial_number:
            self.label = self.serial_number
        self.full_clean()  # Chiama clean() e validatori
        super().save(*args, **kwargs)

    def add_new_reading(self, timestamp, data):
        """
        Aggiunge nuovo dato shiftando gli ultimi 3
        Implementa rolling buffer: nuovo→1, 1→2, 2→3
        """
        from django.utils import timezone

        # Shift dei dati: 1→2, 2→3, nuovo→1
        self.last_timestamp_3 = self.last_timestamp_2
        self.last_data_3 = self.last_data_2

        self.last_timestamp_2 = self.last_timestamp_1
        self.last_data_2 = self.last_data_1

        self.last_timestamp_1 = timestamp
        self.last_data_1 = data

        # Update statistiche
        self.total_readings += 1
        self.last_reading = timestamp
        self.last_seen_at = timestamp

        if not self.first_seen_at:
            self.first_seen_at = timestamp

        # Reset consecutive misses se riceve dato
        self.consecutive_misses = 0
        self.is_online = True

    def update_min_max_stats(self, value):
        """Aggiorna statistiche min/max globali"""
        from django.utils import timezone

        if self.min_value_ever is None or value < self.min_value_ever:
            self.min_value_ever = value
            self.min_recorded_at = timezone.now()

        if self.max_value_ever is None or value > self.max_value_ever:
            self.max_value_ever = value
            self.max_recorded_at = timezone.now()

    def get_latest_readings(self):
        """Ritorna lista degli ultimi 3 dati ordinati (più recente primo)"""
        readings = []

        if self.last_timestamp_1:
            readings.append({
                'timestamp': self.last_timestamp_1,
                'data': self.last_data_1
            })

        if self.last_timestamp_2:
            readings.append({
                'timestamp': self.last_timestamp_2,
                'data': self.last_data_2
            })

        if self.last_timestamp_3:
            readings.append({
                'timestamp': self.last_timestamp_3,
                'data': self.last_data_3
            })

        return readings


