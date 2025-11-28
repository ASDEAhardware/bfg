"""
Helper functions for MQTT logging
"""
import traceback
import logging
from mqtt.models import MqttConnectionLog, MqttParsingLog

logger = logging.getLogger('mqtt.connection')


def log_connection_event(connection, level, message, exception=None, retry_attempt=None):
    """
    Log evento connessione (INFO, WARNING, ERROR)

    Args:
        connection: MqttConnection instance
        level: str - DEBUG, INFO, WARNING, ERROR, CRITICAL
        message: str - Messaggio descrittivo
        exception: Exception instance (optional)
        retry_attempt: int (optional)
    """
    try:
        # Log to file
        log_method = getattr(logger, level.lower())
        log_method(f"[Site {connection.site.name}] {message}")

        # Log to DB
        MqttConnectionLog.objects.create(
            connection=connection,
            level=level,
            message=message,
            exception_type=type(exception).__name__ if exception else '',
            exception_traceback=traceback.format_exc() if exception else '',
            broker_host=connection.broker_host,
            retry_attempt=retry_attempt,
        )
    except Exception as e:
        # Fallback se DB logging fallisce
        logger.error(f"Failed to log connection event: {e}")


def log_parsing_error(site, topic, parser_name, error_type, error_message, payload_sample=None):
    """
    Log errore parsing messaggio MQTT

    Args:
        site: Site instance
        topic: str - Topic MQTT
        parser_name: str - Nome parser (optional)
        error_type: str - VALIDATION_ERROR, PARSE_ERROR, DB_ERROR, UNKNOWN_ERROR
        error_message: str - Descrizione errore
        payload_sample: dict - Sample payload (optional, truncated se troppo grande)
    """
    try:
        # Truncate payload se troppo grande
        if payload_sample and len(str(payload_sample)) > 5000:
            payload_sample = {'_truncated': True, 'sample': str(payload_sample)[:5000]}

        # Log to file
        logger = logging.getLogger('mqtt.parsing')
        logger.error(f"[Site {site.name}] [{error_type}] {topic}: {error_message}")

        # Log to DB
        MqttParsingLog.objects.create(
            site=site,
            topic=topic,
            parser_name=parser_name or '',
            error_type=error_type,
            error_message=error_message,
            exception_type='',
            exception_traceback=traceback.format_exc(),
            payload_sample=payload_sample,
        )
    except Exception as e:
        logger = logging.getLogger('mqtt.parsing')
        logger.error(f"Failed to log parsing error: {e}")
