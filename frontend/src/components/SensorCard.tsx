"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InlineLabelEditor } from "@/components/InlineLabelEditor";
import { SensorDataDisplay } from "@/components/SensorDataDisplay";
import {
  Activity,
  Thermometer,
  Gauge,
  Wind,
  Compass,
  Move,
  Vibrate,
  RotateCcw,
  Droplets,
  BarChart3,
  Circle
} from "lucide-react";

interface SensorCardProps {
  sensor: {
    id: number;
    label: string;
    serial_number: string;
    sensor_type: string;
    unit_of_measure?: string;
    is_online: boolean;
    last_reading?: string;
    current_value?: number;
    datalogger_label: string;
    site_name: string;
    total_messages: number;
    total_readings: number;
    min_value_ever?: number;
    max_value_ever?: number;
    first_seen_at?: string;
    last_seen_at?: string;
    uptime_percentage: number;
    consecutive_misses: number;
    latest_readings?: Array<{
      timestamp: string;
      data: Record<string, any>;
    }>;
    created_at: string;
    updated_at: string;
  };
  onLabelUpdate?: (sensor: SensorCardProps['sensor'], newLabel: string) => void;
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

export function SensorCard({ sensor, onLabelUpdate, showEnhanced = false }: SensorCardProps) {
  const typeConfig = sensorTypeConfig[sensor.sensor_type as keyof typeof sensorTypeConfig] || sensorTypeConfig.other;

  // Handle both old and new sensor data formats
  const isOnline = sensor.is_online;
  const statusInfo = isOnline
    ? { color: "text-green-500", label: "Online", bgColor: "bg-green-500/10" }
    : { color: "text-gray-500", label: "Offline", bgColor: "bg-gray-500/10" };

  const TypeIcon = typeConfig.icon;

  const lastReading = sensor.last_reading || sensor.last_seen_at;
  const lastReadingText = lastReading
    ? (() => {
        const now = new Date();
        const readingTime = new Date(lastReading);
        const diffMs = now.getTime() - readingTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return "Ora";
        if (diffMinutes < 60) return `${diffMinutes}m fa`;
        if (diffHours < 24) return `${diffHours}h fa`;
        return `${diffDays}g fa`;
      })()
    : "Mai";

  const handleLabelUpdate = async (newLabel: string) => {
    if (onLabelUpdate) {
      onLabelUpdate(sensor, newLabel);
    }
  };

  const hasValue = sensor.current_value !== undefined && sensor.current_value !== null;

  // Layout unificato - sempre la stessa struttura base, con dettagli extra se showEnhanced=true
  return (
    <Card className="card-standard h-full">
      <CardContent className="card-content-standard flex flex-col h-full">
        {/* Riga 1: Icona + Titolo (sx) + Badge Status (dx) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`p-1.5 rounded-lg ${typeConfig.bgColor} flex-shrink-0`}>
              <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
            </div>
            <InlineLabelEditor
              label={sensor.label}
              onUpdate={handleLabelUpdate}
              size="sm"
              className="font-semibold text-sm truncate"
            />
          </div>
          <Badge
            variant={isOnline ? "default" : "secondary"}
            className={`text-xs flex-shrink-0 ${
              isOnline
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
            }`}
          >
            {statusInfo.label}
          </Badge>
        </div>

        {/* Riga 2: Valori principali (assi o valore singolo) */}
        <div className="mb-3 py-2 bg-muted/20 rounded-lg">
          {hasValue ? (
            <>
              {/* Accelerometri: mostra 3 assi */}
              {sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g' && sensor.latest_readings?.[0]?.data ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      {(sensor.latest_readings[0].data.acc00 * 1000).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">X</div>
                  </div>
                  <div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      {(sensor.latest_readings[0].data.acc01 * 1000).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Y</div>
                  </div>
                  <div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      {(sensor.latest_readings[0].data.acc02 * 1000).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Z</div>
                  </div>
                </div>
              ) : (
                /* Altri sensori: valore singolo centrato */
                <div className="text-center">
                  <div className="text-lg font-mono font-bold text-foreground">
                    {(() => {
                      if (sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g') {
                        return sensor.current_value ? (sensor.current_value * 1000).toFixed(1) : 'N/A';
                      }
                      if (sensor.unit_of_measure === '°') return sensor.current_value?.toFixed(3);
                      return sensor.current_value?.toFixed(2);
                    })()}
                  </div>
                  {sensor.unit_of_measure && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g' ? 'mg' : sensor.unit_of_measure}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-sm text-muted-foreground">
                {isOnline ? "In attesa dati..." : "Offline"}
              </div>
            </div>
          )}
        </div>

        {/* Riga 3: Dettagli base (sempre presenti) */}
        <div className="space-y-2 mb-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Serial:</span>
            <span className="font-mono">{sensor.serial_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Uptime:</span>
            <span className="font-medium">{sensor.uptime_percentage.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Ultima lettura:</span>
            <span className="font-medium">{lastReadingText}</span>
          </div>
        </div>

        {/* Sezioni extra quando showEnhanced=true */}
        {showEnhanced && (
          <div className="space-y-3 mb-3">
            {/* Statistiche Min/Max */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 p-2 rounded">
                <div className="text-muted-foreground">Min</div>
                <div className="font-medium">
                  {sensor.min_value_ever !== undefined ?
                    `${(sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g' ? sensor.min_value_ever * 1000 : sensor.min_value_ever).toFixed(1)}` : 'N/A'}
                </div>
              </div>
              <div className="bg-muted/50 p-2 rounded">
                <div className="text-muted-foreground">Max</div>
                <div className="font-medium">
                  {sensor.max_value_ever !== undefined ?
                    `${(sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g' ? sensor.max_value_ever * 1000 : sensor.max_value_ever).toFixed(1)}` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Statistiche Messages/Readings */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 p-2 rounded">
                <div className="text-muted-foreground">Messages</div>
                <div className="font-medium">{sensor.total_messages.toLocaleString()}</div>
              </div>
              <div className="bg-muted/50 p-2 rounded">
                <div className="text-muted-foreground">Readings</div>
                <div className="font-medium">{sensor.total_readings.toLocaleString()}</div>
              </div>
            </div>

            {/* Ultimi valori */}
            {sensor.latest_readings && sensor.latest_readings.length > 0 && (
              <>
                <div className="text-xs font-medium text-muted-foreground">Ultimi 3 valori:</div>
                <div className="space-y-1">
                  {sensor.latest_readings.slice(0, 3).map((reading, idx) => {
                    const timestamp = new Date(reading.timestamp).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <div key={idx} className="bg-muted/30 p-1.5 rounded">
                        {sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g' && reading.data ? (
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            <div className="text-center">
                              <div className="text-muted-foreground">X</div>
                              <div className="font-mono font-medium">{(reading.data.acc00 * 1000).toFixed(1)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Y</div>
                              <div className="font-mono font-medium">{(reading.data.acc01 * 1000).toFixed(1)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Z</div>
                              <div className="font-mono font-medium">{(reading.data.acc02 * 1000).toFixed(1)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Tempo</div>
                              <div className="font-mono font-medium">{timestamp}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between text-xs">
                            <span className="font-mono">
                              {(() => {
                                const value = reading.data?.incli_x || reading.data?.value;
                                return value !== undefined ? value.toFixed(3) : 'N/A';
                              })()} {sensor.unit_of_measure || ''}
                            </span>
                            <span className="text-muted-foreground">{timestamp}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Riga 4: Footer con tipo sensore (sempre presente) */}
        <div className="pt-2 border-t border-border/30 mt-auto">
          <div className="text-xs text-muted-foreground text-center truncate">
            {sensor.sensor_type === 'accelerometer' && sensor.unit_of_measure === 'g'
              ? 'Acceleration [mg]'
              : sensor.sensor_type.replace('_', ' ')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}