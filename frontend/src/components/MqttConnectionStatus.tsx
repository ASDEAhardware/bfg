"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  RefreshCw,
  Play,
  Square,
  RotateCcw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useMqttConnectionStatus, useMqttControl } from "@/hooks/useMqttStatus";

interface MqttConnectionStatusProps {
  siteId: string | number;
  siteName?: string;
  showControls?: boolean;
  compact?: boolean;
}

export function MqttConnectionStatus({
  siteId,
  siteName,
  showControls = true,
  compact = false
}: MqttConnectionStatusProps) {
  const { connection, stats, lastHeartbeat } = useMqttConnectionStatus(siteId);
  const { controlConnection, loading: controlLoading } = useMqttControl();

  const getStatusConfig = () => {
    if (!connection) {
      return {
        label: "Non configurato",
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        badgeVariant: "secondary" as const,
        icon: WifiOff
      };
    }

    switch (connection.status) {
      case 'connected':
        return {
          label: "Connesso",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          badgeVariant: "default" as const,
          icon: Wifi
        };
      case 'connecting':
        return {
          label: "Connessione...",
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          badgeVariant: "secondary" as const,
          icon: RefreshCw
        };
      case 'error':
        return {
          label: "Errore",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          badgeVariant: "destructive" as const,
          icon: AlertTriangle
        };
      default:
        return {
          label: "Disconnesso",
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          badgeVariant: "secondary" as const,
          icon: WifiOff
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const lastHeartbeatText = lastHeartbeat
    ? formatDistanceToNow(new Date(lastHeartbeat), {
        addSuffix: true,
        locale: it
      })
    : "Mai";

  const handleControlAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      await controlConnection(siteId, action);
      // Optionally show success message
    } catch (error) {
      console.error(`Failed to ${action} connection:`, error);
      // Optionally show error message
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${statusConfig.bgColor}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-4 w-4 ${statusConfig.color} ${
            connection?.status === 'connecting' ? 'animate-spin' :
            connection?.status === 'connected' ? 'animate-pulse' : ''
          }`} />
          <div>
            <div className="text-sm font-medium">MQTT Connection</div>
            {siteName && <div className="text-xs text-muted-foreground">{siteName}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="text-xs text-muted-foreground">
              {stats.online_sensors}/{stats.total_sensors} online
            </div>
          )}
          <Badge variant={statusConfig.badgeVariant} className="text-xs">
            {statusConfig.label}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className={`transition-all duration-200 ${statusConfig.bgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusConfig.color} ${
              connection?.status === 'connecting' ? 'animate-spin' :
              connection?.status === 'connected' ? 'animate-pulse' : ''
            }`} />
            Connessione MQTT
            {siteName && <span className="text-muted-foreground">- {siteName}</span>}
          </CardTitle>
          <Badge variant={statusConfig.badgeVariant} className="text-xs">
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Connection details */}
        {connection && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stato:</span>
              <span className={statusConfig.color}>{statusConfig.label}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Ultimo heartbeat:</span>
              <span className="text-xs">{lastHeartbeatText}</span>
            </div>

            {connection.connection_errors > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Errori:</span>
                <span className="text-red-500">{connection.connection_errors}</span>
              </div>
            )}

            {connection.error_message && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                {connection.error_message}
              </div>
            )}
          </div>
        )}

        {/* Sensor statistics */}
        {stats && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Statistiche Sensori
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Totali:</span>
                <span>{stats.total_sensors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Online:</span>
                <span className="text-green-600">{stats.online_sensors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offline:</span>
                <span className="text-red-600">{stats.offline_sensors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messaggi:</span>
                <span>{stats.total_messages}</span>
              </div>
            </div>
          </div>
        )}

        {/* Control buttons */}
        {showControls && connection && (
          <div className="flex gap-2 pt-3 border-t">
            {connection.status !== 'connected' && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleControlAction('start')}
                disabled={controlLoading || connection.status === 'connecting'}
                className="flex-1"
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}

            {connection.status === 'connected' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleControlAction('stop')}
                disabled={controlLoading}
                className="flex-1"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleControlAction('restart')}
              disabled={controlLoading}
              className="flex-1"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          </div>
        )}

        {/* Loading state */}
        {controlLoading && (
          <div className="text-center py-2">
            <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}