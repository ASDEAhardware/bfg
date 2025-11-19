import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  FlaskConical,
  Move,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export interface SensorType {
  nameKey: 'temperature_sensor' | 'humidity_sensor' | 'pressure_sensor' | 'co2_sensor' | 'motion_sensor' | 'light_sensor';
  icon: LucideIcon;
}

export const SENSOR_TYPES: SensorType[] = [
  { nameKey: "temperature_sensor", icon: Thermometer },
  { nameKey: "humidity_sensor", icon: Droplets },
  { nameKey: "pressure_sensor", icon: Gauge },
  { nameKey: "co2_sensor", icon: Wind },
  { nameKey: "motion_sensor", icon: Move },
  { nameKey: "light_sensor", icon: Sun },
];

// Un oggetto per un accesso rapido alle icone tramite nome, se necessario
export const SENSOR_ICONS: Record<string, LucideIcon> = SENSOR_TYPES.reduce(
  (acc, sensor) => {
    acc[sensor.nameKey] = sensor.icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);
