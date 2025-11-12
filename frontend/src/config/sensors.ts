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
  name: string;
  icon: LucideIcon;
}

export const SENSOR_TYPES: SensorType[] = [
  { name: "Temperature sensor", icon: Thermometer },
  { name: "Humidity sensor", icon: Droplets },
  { name: "Pressure sensor", icon: Gauge },
  { name: "CO2 sensor", icon: Wind },
  { name: "Motion sensor", icon: Move },
  { name: "Light sensor", icon: Sun },
];

// Un oggetto per un accesso rapido alle icone tramite nome, se necessario
export const SENSOR_ICONS: Record<string, LucideIcon> = SENSOR_TYPES.reduce(
  (acc, sensor) => {
    acc[sensor.name] = sensor.icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);
