
import os
import django
import sys

sys.path.append('/home/bkode/Desktop/bfg/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from mqtt.models import DiscoveredTopic

def clean_discovered_topics():
    count, _ = DiscoveredTopic.objects.all().delete()
    print(f"Eliminati {count} topic scoperti.")

if __name__ == '__main__':
    clean_discovered_topics()
