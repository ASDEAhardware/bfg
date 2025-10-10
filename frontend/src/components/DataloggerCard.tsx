"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Circle,
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  Activity,
  Cpu,
  Network,
  Clock,
  Gauge
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface DataloggerCardProps {
  datalogger: {
    id: string;
    name: string;
    serial_number: string;
    model: string;
    firmware_version?: string;
    ip_address?: string;
    status: 'active' | 'inactive' | 'maintenance' | 'error';
    is_active: boolean;
    last_communication?: string;
    sensors_count: number;
    active_sensors_count: number;
  };
  onConnect: (datalogger: any) => void;
  compact?: boolean;
}

const statusConfig = {
  active: {
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: Wifi,
    label: "Online"
  },
  inactive: {
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: WifiOff,
    label: "Offline"
  },
  maintenance: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    icon: Settings,
    label: "Manutenzione"
  },
  error: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: AlertTriangle,
    label: "Errore"
  }
};

export function DataloggerCard({ datalogger, onConnect, compact = false }: DataloggerCardProps) {
  const config = statusConfig[datalogger.status];
  const StatusIcon = config.icon;

  const lastCommunication = datalogger.last_communication
    ? formatDistanceToNow(new Date(datalogger.last_communication), {
        addSuffix: true,
        locale: it
      })
    : "Mai";

  const isOnline = datalogger.status === 'active';

  if (compact) {
    return (
      <Card className="card-standard">
        <CardContent className="card-content-standard">
          <div className="flex items-center card-spacing">
            {/* Status Icon */}
            <div className={`p-1.5 rounded-full ${config.bgColor} flex-shrink-0`}>
              <StatusIcon className={`h-3 w-3 ${config.color}`} />
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">{datalogger.name}</h3>
                <Badge
                  variant={isOnline ? "default" : "secondary"}
                  className="text-xs px-1.5 py-0.5 h-auto flex-shrink-0"
                >
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="truncate">{datalogger.model}</span>
                <span className="font-mono">{datalogger.serial_number}</span>
                {datalogger.ip_address && (
                  <span className="font-mono hidden sm:inline">{datalogger.ip_address}</span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                <span>{datalogger.active_sensors_count}/{datalogger.sensors_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="min-w-[60px]">{lastCommunication}</span>
              </div>
            </div>

            {/* Connect Button */}
            <Button
              onClick={() => onConnect(datalogger)}
              size="sm"
              className="h-8 px-4 text-xs cursor-pointer flex-shrink-0"
              disabled={!isOnline}
            >
              Connetti
            </Button>
          </div>

          {/* Mobile Metrics */}
          <div className="md:hidden mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                <span>Sensori: {datalogger.active_sensors_count}/{datalogger.sensors_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{lastCommunication}</span>
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
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <StatusIcon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base truncate">{datalogger.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{datalogger.model}</p>
            </div>
          </div>
          <Badge
            variant={isOnline ? "default" : "secondary"}
            className="flex-shrink-0"
          >
            {config.label}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">S/N:</span>
            <span className="font-mono text-xs">{datalogger.serial_number}</span>
          </div>

          {datalogger.ip_address && (
            <div className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">IP:</span>
              <span className="font-mono text-xs">{datalogger.ip_address}</span>
            </div>
          )}

          {datalogger.firmware_version && (
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">FW:</span>
              <span className="text-xs">{datalogger.firmware_version}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sensori:</span>
            <span className="text-xs">
              <span className="font-medium text-green-600">{datalogger.active_sensors_count}</span>
              <span className="text-muted-foreground">/{datalogger.sensors_count} attivi</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ultima comunicazione:</span>
            <span className="text-xs">{lastCommunication}</span>
          </div>
        </div>

        <Button
          onClick={() => onConnect(datalogger)}
          className="w-full cursor-pointer"
          disabled={!isOnline}
        >
          {isOnline ? "Connetti" : "Non disponibile"}
        </Button>
      </CardContent>
    </Card>
  );
}