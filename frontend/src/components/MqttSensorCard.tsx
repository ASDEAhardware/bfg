"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Circle,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { MqttSensorData } from "@/hooks/useMqttStatus";

// Helper function to check if a value is valid for display
const isValidNumber = (value: number | null | undefined): value is number => {
  return value !== null && value !== undefined;
};

interface MqttSensorCardProps {
  sensor: MqttSensorData;
  showDetails?: boolean;
}

export function MqttSensorCard({ sensor, showDetails = true }: MqttSensorCardProps) {
  const isOnline = sensor.is_online;
  const isStale = sensor.last_seen_at
    ? Date.now() - new Date(sensor.last_seen_at).getTime() > 60000 // 1 minute
    : true;

  const lastSeenText = sensor.last_seen_at
    ? formatDistanceToNow(new Date(sensor.last_seen_at), {
        addSuffix: true,
        locale: it
      })
    : "Mai visto";

  const dataTimestamp = sensor.timestamp
    ? formatDistanceToNow(new Date(sensor.timestamp), {
        addSuffix: true,
        locale: it
      })
    : null;

  // Determine status based on online state and data freshness
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        label: "Offline",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        badgeVariant: "destructive" as const
      };
    }
    if (isStale) {
      return {
        label: "Stale",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        badgeVariant: "secondary" as const
      };
    }
    return {
      label: "Online",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      badgeVariant: "default" as const
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <Card className={`card-standard transition-all duration-200 ${
      isOnline && !isStale
        ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30'
        : !isOnline
          ? 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/30'
          : 'border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/30'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            {sensor.device_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className={`h-3 w-3 ${statusConfig.color} ${!isStale ? 'animate-pulse' : ''}`} />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <Badge variant={statusConfig.badgeVariant} className="text-xs">
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Data values when available */}
        {sensor.timestamp && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Accelerometer */}
              {((sensor.acc_x !== undefined && sensor.acc_x !== null) || (sensor.acc_y !== undefined && sensor.acc_y !== null) || (sensor.acc_z !== undefined && sensor.acc_z !== null)) && (
                <div className="col-span-2">
                  <h4 className="font-medium text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Accelerometro
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {sensor.acc_x !== undefined && sensor.acc_x !== null && (
                      <div>
                        <span className="text-muted-foreground">X:</span>
                        <span className="font-mono ml-1">{sensor.acc_x.toFixed(3)}</span>
                      </div>
                    )}
                    {sensor.acc_y !== undefined && sensor.acc_y !== null && (
                      <div>
                        <span className="text-muted-foreground">Y:</span>
                        <span className="font-mono ml-1">{sensor.acc_y.toFixed(3)}</span>
                      </div>
                    )}
                    {sensor.acc_z !== undefined && sensor.acc_z !== null && (
                      <div>
                        <span className="text-muted-foreground">Z:</span>
                        <span className="font-mono ml-1">{sensor.acc_z.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inclinometer */}
              {((sensor.incli_x !== undefined && sensor.incli_x !== null) || (sensor.incli_y !== undefined && sensor.incli_y !== null)) && (
                <div className="col-span-2">
                  <h4 className="font-medium text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Inclinometro
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {sensor.incli_x !== undefined && sensor.incli_x !== null && (
                      <div>
                        <span className="text-muted-foreground">X:</span>
                        <span className="font-mono ml-1">{sensor.incli_x.toFixed(3)}°</span>
                      </div>
                    )}
                    {sensor.incli_y !== undefined && sensor.incli_y !== null && (
                      <div>
                        <span className="text-muted-foreground">Y:</span>
                        <span className="font-mono ml-1">{sensor.incli_y.toFixed(3)}°</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Magnetometer - if available */}
              {showDetails && ((sensor.mag_x !== undefined && sensor.mag_x !== null) || (sensor.mag_y !== undefined && sensor.mag_y !== null) || (sensor.mag_z !== undefined && sensor.mag_z !== null)) && (
                <div className="col-span-2">
                  <h4 className="font-medium text-xs text-muted-foreground mb-1">Magnetometro</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {sensor.mag_x !== undefined && sensor.mag_x !== null && (
                      <div>
                        <span className="text-muted-foreground">X:</span>
                        <span className="font-mono ml-1">{sensor.mag_x.toFixed(2)}</span>
                      </div>
                    )}
                    {sensor.mag_y !== undefined && sensor.mag_y !== null && (
                      <div>
                        <span className="text-muted-foreground">Y:</span>
                        <span className="font-mono ml-1">{sensor.mag_y.toFixed(2)}</span>
                      </div>
                    )}
                    {sensor.mag_z !== undefined && sensor.mag_z !== null && (
                      <div>
                        <span className="text-muted-foreground">Z:</span>
                        <span className="font-mono ml-1">{sensor.mag_z.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gyroscope - if available */}
              {showDetails && ((sensor.gyro_x !== undefined && sensor.gyro_x !== null) || (sensor.gyro_y !== undefined && sensor.gyro_y !== null) || (sensor.gyro_z !== undefined && sensor.gyro_z !== null)) && (
                <div className="col-span-2">
                  <h4 className="font-medium text-xs text-muted-foreground mb-1">Giroscopio</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {sensor.gyro_x !== undefined && sensor.gyro_x !== null && (
                      <div>
                        <span className="text-muted-foreground">X:</span>
                        <span className="font-mono ml-1">{sensor.gyro_x.toFixed(2)}</span>
                      </div>
                    )}
                    {sensor.gyro_y !== undefined && sensor.gyro_y !== null && (
                      <div>
                        <span className="text-muted-foreground">Y:</span>
                        <span className="font-mono ml-1">{sensor.gyro_y.toFixed(2)}</span>
                      </div>
                    )}
                    {sensor.gyro_z !== undefined && sensor.gyro_z !== null && (
                      <div>
                        <span className="text-muted-foreground">Z:</span>
                        <span className="font-mono ml-1">{sensor.gyro_z.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Data timestamp */}
            {dataTimestamp && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Dati di {dataTimestamp}
              </div>
            )}
          </div>
        )}

        {/* No data state */}
        {!sensor.timestamp && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="text-sm text-muted-foreground">
              {isOnline ? "In attesa dati..." : "Sensore offline"}
            </div>
          </div>
        )}

        {/* Status footer */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Messaggi: {sensor.total_messages}</span>
            {sensor.consecutive_misses > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{sensor.consecutive_misses} miss</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Circle className={`h-2 w-2 fill-current ${statusConfig.color}`} />
            <span>{lastSeenText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for list views
 */
export function MqttSensorCardCompact({ sensor }: MqttSensorCardProps) {
  const isOnline = sensor.is_online;
  const hasData = sensor.timestamp !== undefined;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
      isOnline
        ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30'
        : 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/30'
    }`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="font-medium text-sm">{sensor.device_name}</span>
        </div>

        {hasData && sensor.acc_x !== undefined && sensor.acc_x !== null && (
          <div className="text-xs text-muted-foreground">
            Acc: {sensor.acc_x.toFixed(3)}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {sensor.total_messages} msg
        </span>
        <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </div>
    </div>
  );
}