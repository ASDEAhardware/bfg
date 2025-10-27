"""
MQTT API Versioning System
Gestisce versioni MQTT API con supporto per backward/forward compatibility
"""
import re
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)

# Configurazione versioni supportate
SUPPORTED_VERSIONS = {
    "v1": {
        "min_supported": "v1.0.0",
        "max_supported": "v1.9.9",
        "current": "v1.0.0",
        "deprecated": False,
        "sunset_date": None
    },
    "v2": {
        "min_supported": "v2.0.0",
        "max_supported": "v2.9.9",
        "current": "v2.0.0",
        "deprecated": False,
        "sunset_date": None
    }
}


class MqttApiVersion:
    """Parser e validator per versioni MQTT API"""

    def __init__(self, version_string: str):
        self.major, self.minor, self.patch = self._parse(version_string)
        self.string = version_string

    def _parse(self, version: str) -> Tuple[int, int, int]:
        """Parse 'v1.2.3' or '1.2.3' -> (1, 2, 3) or 'v1' -> (1, 0, 0)"""
        try:
            # Try full format with 'v' prefix: v1.2.3
            match = re.match(r'v(\d+)\.(\d+)\.(\d+)', version)
            if match:
                return tuple(map(int, match.groups()))

            # Try full format without 'v' prefix: 1.2.3
            match = re.match(r'(\d+)\.(\d+)\.(\d+)', version)
            if match:
                return tuple(map(int, match.groups()))

            # Try short format with 'v' prefix: v1
            match = re.match(r'v(\d+)$', version)
            if match:
                major = int(match.group(1))
                return (major, 0, 0)

            # Try short format without 'v' prefix: 1
            match = re.match(r'(\d+)$', version)
            if match:
                major = int(match.group(1))
                return (major, 0, 0)

            raise ValueError(f"Invalid version format: {version}")
        except Exception as e:
            logger.warning(f"Error parsing version {version}: {e}, using fallback v1.0.0")
            # Fallback to v1.0.0
            return (1, 0, 0)

    def is_compatible_with(self, other) -> bool:
        """Major version must match for compatibility"""
        return self.major == other.major

    def is_newer_than(self, other) -> bool:
        """Check if this version is newer than other"""
        return (self.major, self.minor, self.patch) > (other.major, other.minor, other.patch)

    def __str__(self):
        return self.string

    def __ge__(self, other_version_string: str) -> bool:
        """Allow version >= "v1.1.0" comparisons"""
        other = MqttApiVersion(other_version_string)
        return (self.major, self.minor, self.patch) >= (other.major, other.minor, other.patch)


class UnsupportedVersionError(Exception):
    """Raised when an unsupported MQTT API version is encountered"""
    pass


class VersionedMqttMessageProcessor:
    """Main processor che gestisce routing basato su versione"""

    def __init__(self):
        self.processors = {
            1: MqttV1Processor(),
            # 2: MqttV2Processor(),  # Future expansion
        }
        self.version_usage_tracker = VersionUsageTracker()

    def process_message(self, topic: str, payload: dict, site_id: int) -> bool:
        """Process message con version-aware routing"""
        try:
            # Estrai version info
            version_info = self._extract_version_info(payload)
            api_version = MqttApiVersion(version_info['mqtt_api_version'])

            # Track usage per analytics
            self.version_usage_tracker.track_usage(api_version.string, topic, site_id)

            # Validazione compatibilità
            if not self._is_version_supported(api_version):
                return self._handle_unsupported_version(api_version, payload, topic)

            # Routing al processore corretto
            processor = self.processors.get(api_version.major)
            if not processor:
                logger.error(f"No processor available for major version {api_version.major}")
                return False

            return processor.process(topic, payload, version_info, site_id)

        except Exception as e:
            logger.error(f"Error in versioned message processing: {e}")
            return False

    def _extract_version_info(self, payload: dict) -> dict:
        """Estrae informazioni versioning dal payload"""
        return {
            'mqtt_api_version': payload.get('mqtt_api_version', 'v1.0.0'),
            'timestamp': payload.get('timestamp'),
            'message_interval_seconds': payload.get('message_interval_seconds', 60)
        }

    def _is_version_supported(self, version: MqttApiVersion) -> bool:
        """Check if version is supported"""
        major_key = f"v{version.major}"
        if major_key not in SUPPORTED_VERSIONS:
            return False

        config = SUPPORTED_VERSIONS[major_key]
        min_version = MqttApiVersion(config['min_supported'])
        max_version = MqttApiVersion(config['max_supported'])

        return (version.major, version.minor, version.patch) >= (min_version.major, min_version.minor, min_version.patch) and \
               (version.major, version.minor, version.patch) <= (max_version.major, max_version.minor, max_version.patch)

    def _handle_unsupported_version(self, version: MqttApiVersion, payload: dict, topic: str) -> bool:
        """Handle unsupported version - try graceful degradation"""
        logger.warning(f"Unsupported MQTT API version {version.string} on topic {topic}")

        # Try to use latest supported processor as fallback
        fallback_processor = self.processors.get(1)  # v1 as fallback
        if fallback_processor:
            logger.info(f"Attempting fallback processing with v1 processor")
            version_info = self._extract_version_info(payload)
            version_info['mqtt_api_version'] = 'v1.0.0'  # Override to v1
            return fallback_processor.process(topic, payload, version_info, None)

        return False


class MqttV1Processor:
    """Processor per MQTT API v1.x"""

    def process(self, topic: str, payload: dict, version_info: dict, site_id: int) -> bool:
        """Process message according to v1 API specs"""
        api_version = MqttApiVersion(version_info['mqtt_api_version'])

        # Import qui per evitare circular imports
        from .message_processor import message_processor

        # Log versioning info
        logger.debug(f"Processing {api_version.string} message on topic {topic}")

        # V1 processing - usa il processore esistente ma con version awareness
        if api_version >= "v1.0.0":
            return self._process_v1_0_plus(topic, payload, version_info, site_id, message_processor)
        else:
            logger.warning(f"Version {api_version.string} below minimum v1.0.0")
            return False

    def _process_v1_0_plus(self, topic: str, payload: dict, version_info: dict,
                          site_id: int, message_processor) -> bool:
        """Process v1.0+ messages"""
        try:
            # Aggiorna il payload con version info per il processore legacy
            enhanced_payload = payload.copy()
            enhanced_payload['_version_info'] = version_info

            # Usa il processore esistente
            payload_bytes = str(enhanced_payload).encode('utf-8')

            # Call existing processor ma passa anche version info
            return message_processor._process_versioned_message(
                site_id, topic, payload, version_info
            )

        except Exception as e:
            logger.error(f"Error in v1 processing: {e}")
            return False


class VersionUsageTracker:
    """Tracks version usage for analytics"""

    def __init__(self):
        self.usage_cache = {}  # In-memory cache per performance
        self.cache_flush_interval = 300  # 5 minutes
        self.last_flush = timezone.now()

    def track_usage(self, version: str, topic: str, site_id: int):
        """Track version usage"""
        try:
            # Simple in-memory tracking
            key = f"{version}:{topic}"
            if key not in self.usage_cache:
                self.usage_cache[key] = {
                    'version': version,
                    'topic': topic,
                    'site_id': site_id,
                    'count': 0,
                    'first_seen': timezone.now(),
                    'last_seen': timezone.now()
                }

            self.usage_cache[key]['count'] += 1
            self.usage_cache[key]['last_seen'] = timezone.now()

            # Flush periodically to database
            if (timezone.now() - self.last_flush).seconds > self.cache_flush_interval:
                self._flush_to_database()

        except Exception as e:
            logger.error(f"Error tracking version usage: {e}")

    def _flush_to_database(self):
        """Flush usage data to database"""
        try:
            from ..models import MqttApiVersionUsage

            for key, data in self.usage_cache.items():
                usage, created = MqttApiVersionUsage.objects.get_or_create(
                    version=data['version'],
                    topic_pattern=data['topic'],
                    site_id=data['site_id'],
                    defaults={
                        'message_count': data['count'],
                        'first_seen_at': data['first_seen'],
                        'last_seen_at': data['last_seen']
                    }
                )

                if not created:
                    # Update existing record
                    usage.message_count += data['count']
                    usage.last_seen_at = data['last_seen']
                    usage.save()

            # Clear cache after flush
            self.usage_cache.clear()
            self.last_flush = timezone.now()

            logger.debug("Version usage data flushed to database")

        except Exception as e:
            logger.error(f"Error flushing version usage to database: {e}")


class VersionLifecycleManager:
    """Manages version lifecycle, deprecation, sunset"""

    def check_deprecation_status(self, version: str) -> str:
        """Check deprecation status of a version"""
        try:
            api_version = MqttApiVersion(version)
            major_key = f"v{api_version.major}"

            config = SUPPORTED_VERSIONS.get(major_key)
            if not config:
                return "unsupported"

            if config['deprecated']:
                if config['sunset_date']:
                    sunset_date = datetime.fromisoformat(config['sunset_date'])
                    days_to_sunset = (sunset_date - timezone.now()).days

                    if days_to_sunset <= 30:
                        return "sunset_warning"
                    else:
                        return "deprecated"
                else:
                    return "deprecated"

            return "active"

        except Exception as e:
            logger.error(f"Error checking deprecation status for {version}: {e}")
            return "unknown"

    def log_version_usage(self, version: str, topic: str):
        """Log version usage for analytics"""
        status = self.check_deprecation_status(version)

        if status in ['deprecated', 'sunset_warning']:
            logger.warning(f"DEPRECATED API version {version} used on topic {topic} - status: {status}")
        else:
            logger.debug(f"API version {version} used on topic {topic} - status: {status}")


# Global instance
versioned_processor = VersionedMqttMessageProcessor()
lifecycle_manager = VersionLifecycleManager()