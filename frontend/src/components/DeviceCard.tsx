"use client";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineLabelEditor } from "@/components/InlineLabelEditor";
import { api } from "@/lib/axios";
import {
  Settings,
  Activity,
  Cpu,
  Network,
  Clock,
  Gauge,
  Router,
  HardDrive,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface DeviceCardProps {
  datalogger: {
    id: string;
    site_id: number;
    site_name: string;
    serial_number: string;
    label: string;
    datalogger_type: string;
    device_id?: string;
    is_online: boolean;
    last_seen_at?: string;
    last_heartbeat?: string;
    last_communication?: string;
    firmware_version?: string;
    ip_address?: string;
    total_heartbeats: number;
    missed_heartbeats: number;
    uptime_percentage: number;
    sensors_count: number;
    active_sensors_count: number;
    created_at: string;
    updated_at: string;
  };
  onConnect: (datalogger: DeviceCardProps['datalogger']) => void;
  onLabelUpdate?: (datalogger: DeviceCardProps['datalogger'], newLabel: string) => void;
  compact?: boolean;
}

const statusConfig = {
  online: {
    label: "Online",
    variant: "default" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
  },
  offline: {
    label: "Offline",
    variant: "outline" as const,
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
  }
};

export function DeviceCard({ datalogger, onConnect, onLabelUpdate, compact = false }: DeviceCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);

  // Determine status based on is_online field
  const status = datalogger.is_online ? 'online' : 'offline';
  const config = statusConfig[status] || statusConfig.offline;

  // Use last_seen_at as primary, with fallbacks
  const lastCommunication = datalogger.last_seen_at || datalogger.last_heartbeat || datalogger.last_communication;
  const lastCommText = lastCommunication
    ? formatDistanceToNow(new Date(lastCommunication), {
        addSuffix: true,
        locale: it
      })
    : "Mai";

  const isOnline = datalogger.is_online;

  const handleLabelUpdate = async (newLabel: string) => {
    try {
      await api.patch(`/v1/mqtt/devices/${datalogger.id}/update_label/`, {
        label: newLabel
      });

      // Callback al parent per aggiornare la lista
      if (onLabelUpdate) {
        onLabelUpdate(datalogger, newLabel);
      }
    } catch (error) {
      console.error('Error updating datalogger label:', error);
      throw error;
    }
  };

  const handleConnect = () => {
    setIsNavigating(true);
    onConnect(datalogger);
  };

  // Build display name from datalogger_type and device_id
  const deviceName = datalogger.device_id
    ? `${datalogger.datalogger_type}/${datalogger.device_id}`
    : datalogger.datalogger_type || 'Unknown';

  if (compact) {
    return (
      <Card className="card-standard">
        <CardContent className="card-content-standard">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon + Label + Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-1 rounded bg-blue-500/10 flex-shrink-0">
                <HardDrive className="h-3 w-3 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <InlineLabelEditor
                  label={datalogger.label}
                  onUpdate={handleLabelUpdate}
                  size="sm"
                  className="font-semibold text-sm truncate"
                />
                <div className="text-xs text-muted-foreground truncate">
                  {datalogger.serial_number}
                </div>
              </div>
            </div>

            {/* Center: Status Badge */}
            <div className="flex items-center gap-3">
              <Badge
                variant={config.variant}
                className={`text-xs flex-shrink-0 ${config.className}`}
              >
                {config.label}
              </Badge>
            </div>

            {/* Center: Metrics */}
            <div className="hidden lg:flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                <span>{datalogger.active_sensors_count}/{datalogger.sensors_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                <span>{datalogger.uptime_percentage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="min-w-[60px]">{lastCommText}</span>
              </div>
            </div>

            {/* Right: Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={isNavigating}
              size="sm"
              className="h-8 px-4 text-xs cursor-pointer flex-shrink-0"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Caricamento...
                </>
              ) : (
                "Visualizza"
              )}
            </Button>
          </div>

          {/* Mobile Metrics */}
          <div className="lg:hidden mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  <span>Sensori: {datalogger.active_sensors_count}/{datalogger.sensors_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>Uptime: {datalogger.uptime_percentage.toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{lastCommText}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-standard">
      <CardContent className="card-content-detailed">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <InlineLabelEditor
              label={datalogger.label}
              onUpdate={handleLabelUpdate}
              size="sm"
              className="text-sm font-semibold truncate"
            />
          </div>
          <Badge
            variant={config.variant}
            className={`flex-shrink-0 ${config.className}`}
          >
            {config.label}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">S/N:</span>
            <span className="font-mono text-xs text-foreground">{datalogger.serial_number}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Router className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Tipo:</span>
            <span className="text-xs text-foreground">{datalogger.datalogger_type}</span>
            {datalogger.device_id && (
              <>
                <span className="text-muted-foreground">ID:</span>
                <span className="text-xs font-mono text-foreground">{datalogger.device_id}</span>
              </>
            )}
          </div>

          {datalogger.ip_address && (
            <div className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">IP:</span>
              <span className="font-mono text-xs text-foreground">{datalogger.ip_address}</span>
            </div>
          )}

          {datalogger.firmware_version && (
            <div className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">FW:</span>
              <span className="text-xs text-foreground">{datalogger.firmware_version}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sensori:</span>
            <span className="text-xs text-foreground">
              {datalogger.active_sensors_count}/{datalogger.sensors_count} attivi
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Uptime:</span>
            <span className="text-xs text-foreground">
              {datalogger.uptime_percentage.toFixed(1)}%
              <span className="text-muted-foreground ml-1">
                ({datalogger.total_heartbeats - datalogger.missed_heartbeats}/{datalogger.total_heartbeats} heartbeats)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ultima comunicazione:</span>
            <span className="text-xs text-foreground">{lastCommText}</span>
          </div>
        </div>

        <Button
          onClick={handleConnect}
          disabled={isNavigating}
          className="w-full cursor-pointer"
        >
          {isNavigating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Caricamento...
            </>
          ) : (
            "Visualizza"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}