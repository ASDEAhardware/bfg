"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InlineLabelEditor } from "@/components/InlineLabelEditor";
import { SensorDataDisplay } from "@/components/SensorDataDisplay";
// import { api } from "@/lib/axios";
import {
  Activity,
  AlertTriangle,
  Thermometer,
  Gauge,
  Zap,
  Wind,
  Compass,
  Move,
  Vibrate,
  RotateCcw,
  Droplets,
  BarChart3,
  Circle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface SensorCardProps {
  sensor: {
    id: string;
    name: string;
    sensor_type: string;
    channel: number;
    unit_of_measure?: string;
    min_value?: number;
    max_value?: number;
    status: 'active' | 'inactive' | 'calibrating' | 'error' | 'maintenance';
    is_active?: boolean;
    is_online?: boolean; // Nuovo campo
    last_reading?: string;
    current_value?: number;
    description?: string;
    latest_readings?: Array<{
      timestamp: string;
      data: Record<string, any>;
    }>;
    last_value?: number;
    stats?: {
      min_ever: number | null;
      max_ever: number | null;
      total_readings: number;
      uptime_percentage: number;
      days_active: number;
    };
  };
  onLabelUpdate?: (sensor: any, newLabel: string) => void;
  showEnhanced?: boolean;
}

const sensorTypeConfig = {
  temperature: { icon: Thermometer, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  humidity: { icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  pressure: { icon: BarChart3, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  accelerometer: { icon: Move, color: "text-green-500", bgColor: "bg-green-500/10" },
  strain_gauge: { icon: Gauge, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  displacement: { icon: Move, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  vibration: { icon: Vibrate, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  tilt: { icon: RotateCcw, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
  wind_speed: { icon: Wind, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  wind_direction: { icon: Compass, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  other: { icon: Activity, color: "text-gray-500", bgColor: "bg-gray-500/10" }
};

const statusConfig = {
  active: { color: "text-green-500", label: "Attivo", bgColor: "bg-green-500/10" },
  inactive: { color: "text-gray-500", label: "Inattivo", bgColor: "bg-gray-500/10" },
  calibrating: { color: "text-yellow-500", label: "Calibrazione", bgColor: "bg-yellow-500/10" },
  error: { color: "text-red-500", label: "Errore", bgColor: "bg-red-500/10" },
  maintenance: { color: "text-orange-500", label: "Manutenzione", bgColor: "bg-orange-500/10" }
};

export function SensorCard({ sensor, onLabelUpdate, showEnhanced = false }: SensorCardProps) {
  const typeConfig = sensorTypeConfig[sensor.sensor_type as keyof typeof sensorTypeConfig] || sensorTypeConfig.other;
  const statusInfo = statusConfig[sensor.status];
  const TypeIcon = typeConfig.icon;

  const lastReading = sensor.last_reading
    ? formatDistanceToNow(new Date(sensor.last_reading), {
        addSuffix: true,
        locale: it
      })
    : "Mai";

  const handleLabelUpdate = async (newLabel: string) => {
    try {
      // TODO: Replace with new MQTT API when rewritten
      // await api.patch(`/v1/mqtt/sensors/${sensor.id}/update_label/`, {
      //   label: newLabel
      // });

      // Callback al parent per aggiornare la lista
      if (onLabelUpdate) {
        onLabelUpdate(sensor, newLabel);
      }
    } catch (error) {
      console.error('Error updating sensor label:', error);
      throw error;
    }
  };

  const isOnline = sensor.is_online ?? (sensor.status === 'active');
  const hasValue = sensor.current_value !== undefined && sensor.current_value !== null;

  // Se showEnhanced è true, usa il display avanzato
  if (showEnhanced) {
    return (
      <Card className="card-standard">
        <CardContent className="card-content-standard">
          <div className="space-y-3">
            {/* Header con nome editabile */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`p-1.5 rounded-lg ${typeConfig.bgColor} shrink-0`}>
                  <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <InlineLabelEditor
                    label={sensor.name}
                    onUpdate={handleLabelUpdate}
                    size="sm"
                    className="font-semibold"
                  />
                  <p className="text-xs text-muted-foreground">Ch{sensor.channel}</p>
                </div>
              </div>
              <Badge
                variant={isOnline ? "default" : "secondary"}
                className="text-xs px-2 py-1 h-auto flex-shrink-0"
              >
                {statusInfo.label}
              </Badge>
            </div>

            {/* Dati avanzati */}
            <SensorDataDisplay sensor={sensor} compact={true} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-standard h-[140px]">
      <CardContent className="p-3 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`p-1.5 rounded-lg ${typeConfig.bgColor} shrink-0`}>
              <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <InlineLabelEditor
                label={sensor.name}
                onUpdate={handleLabelUpdate}
                size="sm"
                className="font-semibold"
              />
              <p className="text-xs text-muted-foreground">Ch{sensor.channel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Circle className={`h-2 w-2 fill-current ${statusInfo.color} ${isOnline ? 'animate-pulse' : ''}`} />
            <Badge
              variant={isOnline ? "default" : "secondary"}
              className="text-xs px-1.5 py-0.5 h-auto"
            >
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Value Display */}
        <div className="flex-1 flex items-center justify-center">
          {hasValue ? (
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">
                {sensor.current_value?.toFixed(2)}
              </div>
              {sensor.unit_of_measure && (
                <div className="text-xs text-muted-foreground mt-1">
                  {sensor.unit_of_measure}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                {isOnline ? "In attesa dati..." : "Offline"}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
          <span className="truncate">{sensor.sensor_type.replace('_', ' ')}</span>
          <span>{lastReading}</span>
        </div>
      </CardContent>
    </Card>
  );
}