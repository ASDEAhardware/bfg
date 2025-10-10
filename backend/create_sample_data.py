#!/usr/bin/env python
import os
import sys
import django
from datetime import datetime, timedelta
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.append('/app')
django.setup()

from sites.models import Site, Datalogger, Sensor, DataloggerStatus, SensorStatus, SensorType

def create_sample_data():
    print("Creating sample datalogger and sensor data...")

    # Get some existing sites
    sites = list(Site.objects.all()[:5])
    if not sites:
        print("No sites found. Please create sites first.")
        return

    # Sample dataloggers
    dataloggers_data = [
        {
            'site': sites[0],
            'name': 'DataLogger Principale',
            'serial_number': 'DL001-2024',
            'model': 'Campbell CR1000X',
            'firmware_version': '1.2.3',
            'ip_address': '192.168.1.100',
            'status': DataloggerStatus.ACTIVE,
            'description': 'Acquisitore principale per monitoraggio strutturale'
        },
        {
            'site': sites[0],
            'name': 'Stazione Meteo',
            'serial_number': 'DL002-2024',
            'model': 'Campbell CR300',
            'firmware_version': '2.1.0',
            'ip_address': '192.168.1.101',
            'status': DataloggerStatus.ACTIVE,
            'description': 'Stazione meteorologica automatica'
        },
        {
            'site': sites[1],
            'name': 'Acquisitore Sismico',
            'serial_number': 'DL003-2024',
            'model': 'Reftek 130-01',
            'firmware_version': '3.0.1',
            'ip_address': '192.168.1.102',
            'status': DataloggerStatus.MAINTENANCE,
            'description': 'Sistema di acquisizione dati sismici'
        },
        {
            'site': sites[1],
            'name': 'Monitor Vibrazione',
            'serial_number': 'DL004-2024',
            'model': 'National Instruments cDAQ',
            'firmware_version': '1.8.5',
            'ip_address': '192.168.1.103',
            'status': DataloggerStatus.ACTIVE,
            'description': 'Monitoraggio vibrazioni in tempo reale'
        },
        {
            'site': sites[2],
            'name': 'Sistema Inclinometrico',
            'serial_number': 'DL005-2024',
            'model': 'Slope Indicator DataMate',
            'firmware_version': '2.5.0',
            'ip_address': '192.168.1.104',
            'status': DataloggerStatus.ERROR,
            'description': 'Acquisitore per catene inclinometriche'
        },
        {
            'site': sites[3],
            'name': 'Controllo Ambientale',
            'serial_number': 'DL006-2024',
            'model': 'HOBO U30',
            'firmware_version': '1.0.2',
            'ip_address': '192.168.1.105',
            'status': DataloggerStatus.ACTIVE,
            'description': 'Monitoraggio parametri ambientali'
        }
    ]

    # Create dataloggers
    created_dataloggers = []
    for dl_data in dataloggers_data:
        datalogger, created = Datalogger.objects.get_or_create(
            serial_number=dl_data['serial_number'],
            defaults={
                **dl_data,
                'last_communication': timezone.now() - timedelta(minutes=5)
            }
        )
        if created:
            print(f"Created datalogger: {datalogger.name}")
        else:
            print(f"Datalogger already exists: {datalogger.name}")
        created_dataloggers.append(datalogger)

    # Sample sensors for each datalogger
    sensors_data = [
        # DataLogger Principale
        [
            {'name': 'Accelerometro X', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 1, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Accelerometro Y', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 2, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Accelerometro Z', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 3, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Estensimetro 1', 'sensor_type': SensorType.STRAIN_GAUGE, 'channel': 4, 'unit': 'με', 'status': SensorStatus.ACTIVE},
            {'name': 'Estensimetro 2', 'sensor_type': SensorType.STRAIN_GAUGE, 'channel': 5, 'unit': 'με', 'status': SensorStatus.ACTIVE},
            {'name': 'Temperatura Interna', 'sensor_type': SensorType.TEMPERATURE, 'channel': 6, 'unit': '°C', 'status': SensorStatus.ACTIVE}
        ],
        # Stazione Meteo
        [
            {'name': 'Temperatura Aria', 'sensor_type': SensorType.TEMPERATURE, 'channel': 1, 'unit': '°C', 'status': SensorStatus.ACTIVE},
            {'name': 'Umidità Relativa', 'sensor_type': SensorType.HUMIDITY, 'channel': 2, 'unit': '%', 'status': SensorStatus.ACTIVE},
            {'name': 'Pressione Atmosferica', 'sensor_type': SensorType.PRESSURE, 'channel': 3, 'unit': 'hPa', 'status': SensorStatus.ACTIVE},
            {'name': 'Velocità Vento', 'sensor_type': SensorType.WIND_SPEED, 'channel': 4, 'unit': 'm/s', 'status': SensorStatus.ACTIVE},
            {'name': 'Direzione Vento', 'sensor_type': SensorType.WIND_DIRECTION, 'channel': 5, 'unit': '°', 'status': SensorStatus.ACTIVE}
        ],
        # Acquisitore Sismico
        [
            {'name': 'Sismometro NS', 'sensor_type': SensorType.VIBRATION, 'channel': 1, 'unit': 'm/s²', 'status': SensorStatus.MAINTENANCE},
            {'name': 'Sismometro EW', 'sensor_type': SensorType.VIBRATION, 'channel': 2, 'unit': 'm/s²', 'status': SensorStatus.MAINTENANCE},
            {'name': 'Sismometro Z', 'sensor_type': SensorType.VIBRATION, 'channel': 3, 'unit': 'm/s²', 'status': SensorStatus.MAINTENANCE}
        ],
        # Monitor Vibrazione
        [
            {'name': 'Accelerometro Ponte A1', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 1, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Accelerometro Ponte A2', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 2, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Accelerometro Ponte A3', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 3, 'unit': 'g', 'status': SensorStatus.ACTIVE},
            {'name': 'Accelerometro Ponte A4', 'sensor_type': SensorType.ACCELEROMETER, 'channel': 4, 'unit': 'g', 'status': SensorStatus.ACTIVE}
        ],
        # Sistema Inclinometrico
        [
            {'name': 'Inclinometro 1m', 'sensor_type': SensorType.TILT, 'channel': 1, 'unit': 'mm/m', 'status': SensorStatus.ERROR},
            {'name': 'Inclinometro 2m', 'sensor_type': SensorType.TILT, 'channel': 2, 'unit': 'mm/m', 'status': SensorStatus.ERROR},
            {'name': 'Inclinometro 3m', 'sensor_type': SensorType.TILT, 'channel': 3, 'unit': 'mm/m', 'status': SensorStatus.INACTIVE}
        ],
        # Controllo Ambientale
        [
            {'name': 'Temperatura Ambiente', 'sensor_type': SensorType.TEMPERATURE, 'channel': 1, 'unit': '°C', 'status': SensorStatus.ACTIVE},
            {'name': 'Umidità Ambiente', 'sensor_type': SensorType.HUMIDITY, 'channel': 2, 'unit': '%', 'status': SensorStatus.ACTIVE}
        ]
    ]

    # Create sensors
    for i, datalogger in enumerate(created_dataloggers):
        if i < len(sensors_data):
            for sensor_data in sensors_data[i]:
                sensor, created = Sensor.objects.get_or_create(
                    datalogger=datalogger,
                    channel=sensor_data['channel'],
                    defaults={
                        'name': sensor_data['name'],
                        'sensor_type': sensor_data['sensor_type'],
                        'unit_of_measure': sensor_data['unit'],
                        'status': sensor_data['status'],
                        'min_value': -1000.0,
                        'max_value': 1000.0,
                        'calibration_factor': 1.0,
                        'calibration_offset': 0.0,
                        'last_reading': timezone.now() - timedelta(minutes=2)
                    }
                )
                if created:
                    print(f"Created sensor: {sensor.name} on {datalogger.name}")
                else:
                    print(f"Sensor already exists: {sensor.name}")

    print("\nSample data creation completed!")

    # Print summary
    print(f"\nSummary:")
    print(f"Sites: {Site.objects.count()}")
    print(f"Dataloggers: {Datalogger.objects.count()}")
    print(f"Sensors: {Sensor.objects.count()}")

if __name__ == "__main__":
    create_sample_data()