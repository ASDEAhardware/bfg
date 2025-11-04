"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Clock,
  Target,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface SensorReading {
  timestamp: string;
  data: Record<string, any>;
}

interface SensorStats {
  min_ever: number | null;
  max_ever: number | null;
  total_readings: number;
  uptime_percentage: number;
  days_active: number;
}

interface SensorDataDisplayProps {
  sensor: {
    id: string;
    name: string;
    serial_number: string;
    sensor_type?: string;
    unit_of_measure?: string;
    is_online: boolean;
    last_reading?: string;
    latest_readings?: SensorReading[];
    stats?: SensorStats;
  };
  compact?: boolean;
}

export function SensorDataDisplay({ sensor, compact = false }: SensorDataDisplayProps) {
  const readings = sensor.latest_readings || [];
  const stats = sensor.stats;
  const latestReading = readings[0];

  // Estrae valore numerico principale dal primo reading
  const getMainValue = (data: Record<string, any>) => {
    const numericKeys = Object.keys(data).filter(key =>
      typeof data[key] === 'number' &&
      (key.startsWith('last_') || ['acc_x', 'acc_y', 'acc_z', 'incli_x', 'incli_y'].includes(key))
    );

    if (numericKeys.length === 0) return null;
    return data[numericKeys[0]];
  };

  const formatValue = (value: number | null, unit?: string) => {
    if (value === null || value === undefined) return 'N/A';

    // Format con precisione basata sulla grandezza del numero
    let formatted: string;
    if (Math.abs(value) >= 1000) {
      formatted = value.toFixed(0);
    } else if (Math.abs(value) >= 1) {
      formatted = value.toFixed(2);
    } else {
      formatted = value.toFixed(4);
    }

    return unit ? `${formatted} ${unit}` : formatted;
  };

  const currentValue = latestReading ? getMainValue(latestReading.data) : null;
  const trend = readings.length >= 2 ?
    (getMainValue(readings[0].data) || 0) - (getMainValue(readings[1].data) || 0) : 0;

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Valore attuale e trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-semibold">
              {formatValue(currentValue, sensor.unit_of_measure)}
            </span>
            {trend !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{Math.abs(trend).toFixed(3)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${
              sensor.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span>{sensor.is_online ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {/* Stats rapide */}
        {stats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{stats.uptime_percentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>{stats.total_readings}</span>
            </div>
            {sensor.last_reading && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(sensor.last_reading), {
                    addSuffix: true,
                    locale: it
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{sensor.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {sensor.sensor_type} • {sensor.serial_number}
            </p>
          </div>
          <Badge variant={sensor.is_online ? "default" : "secondary"}>
            {sensor.is_online ? "Online" : "Offline"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Valore corrente */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Valore Attuale</p>
            <p className="text-2xl font-mono font-bold">
              {formatValue(currentValue, sensor.unit_of_measure)}
            </p>
          </div>
          {trend !== 0 && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              trend > 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-medium">{trend > 0 ? '+' : ''}{trend.toFixed(3)}</span>
            </div>
          )}
        </div>

        {/* Ultimi 3 valori */}
        {readings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Ultimi Valori
            </h4>
            <div className="space-y-2">
              {readings.map((reading, index) => {
                const value = getMainValue(reading.data);
                const timeAgo = formatDistanceToNow(new Date(reading.timestamp), {
                  addSuffix: true,
                  locale: it
                });

                return (
                  <div key={index} className={`flex items-center justify-between p-2 rounded ${
                    index === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                      <span className="font-mono text-sm">
                        {formatValue(value, sensor.unit_of_measure)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Statistiche */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Min/Max
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-mono">
                    {formatValue(stats.min_ever, sensor.unit_of_measure)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-mono">
                    {formatValue(stats.max_ever, sensor.unit_of_measure)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Attività
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Uptime:</span>
                    <span className="font-medium">{stats.uptime_percentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats.uptime_percentage} className="h-2" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Letture:</span>
                  <span>{stats.total_readings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Giorni attivo:</span>
                  <span>{stats.days_active}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}