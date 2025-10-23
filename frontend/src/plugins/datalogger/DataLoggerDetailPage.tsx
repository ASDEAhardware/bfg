"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { SharedDataloggerLayout, useDataloggerSettings } from "./SharedDataloggerLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SensorCard } from "@/components/SensorCard";
import { ContextualStatusBar, useContextualStatusBar } from "@/components/ContextualStatusBar";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useUserInfo } from "@/hooks/useAuth";
import { useMqttConnectionStatus, useDataloggers, useSensors } from "@/hooks/useMqtt";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  Eye,
  MoreHorizontal,
  Activity,
  Gauge
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface Sensor {
  id: number;
  label: string;
  serial_number: string;
  sensor_type: string;
  unit_of_measure?: string;
  is_online: boolean;
  last_reading?: string;
  latest_readings?: any[];
  current_value?: number;
  datalogger_label: string;
  site_name: string;
  total_messages: number;
  missed_messages: number;
  uptime_percentage: number;
  created_at: string;
  updated_at: string;
}

export default function DataLoggerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dataloggerIdParam = params?.id;
  const dataloggerId = Array.isArray(dataloggerIdParam) ? dataloggerIdParam[0] : dataloggerIdParam;

  const { selectedSiteId } = useUnifiedSiteContext();
  const { data: userData } = useUserInfo();
  const { autoRefreshEnabled, chartOpacity } = useDataloggerSettings();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // MQTT hooks
  const { mqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { dataloggers } = useDataloggers(selectedSiteId);
  const {
    sensors,
    loading: sensorsLoading,
    refreshSensors
  } = useSensors(dataloggerId ? parseInt(dataloggerId) : null);

  // Status bar
  const { contextualItems, setContextualItems } = useContextualStatusBar();

  // Find the current datalogger
  const selectedLogger = dataloggers?.find(d => d.id.toString() === dataloggerId);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshEnabled || !dataloggerId || !selectedLogger?.is_online) return;

    const interval = setInterval(() => {
      refreshSensors();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, dataloggerId, selectedLogger?.is_online, autoRefreshInterval, refreshSensors]);

  // Status bar items
  useEffect(() => {
    if (!selectedLogger || !sensors) return;

    const onlineSensors = sensors.filter(s => s.is_online).length;
    const totalSensors = sensors.length;

    const items = [
      { label: "Datalogger", value: selectedLogger.label },
      { label: "Sensori", value: `${onlineSensors}/${totalSensors}` },
      {
        label: "MQTT Connection",
        value: mqttStatus === 'connected' ? 'Connected' : 'Disconnected',
        color: mqttStatus === 'connected' ? 'success' : 'warning'
      }
    ];

    if (selectedLogger.is_online) {
      items.push({
        label: "Status",
        value: "Online",
        color: "success"
      });
    } else {
      items.push({
        label: "Status",
        value: "Offline",
        color: "warning"
      });
    }

    setContextualItems(items);
  }, [selectedLogger, sensors, mqttStatus, setContextualItems]);

  // Focus search when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Filter sensors
  const filteredSensors = sensors?.filter((sensor: Sensor) => {
    const matchesSearch = !searchTerm ||
      sensor.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOnlineFilter = showOnlineOnly ? sensor.is_online : true;
    return matchesSearch && matchesOnlineFilter;
  });

  const handleSensorLabelUpdate = async (sensor: Sensor, newLabel: string) => {
    await refreshSensors();
  };

  // Go back to list
  const handleBack = () => {
    router.push('/datalogger');
  };

  // Header actions
  const headerActions = (
    <>
      {/* Back Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="h-6 px-2 text-xs"
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Indietro
      </Button>

      {/* Search */}
      <Button
        variant={isSearchOpen ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsSearchOpen(!isSearchOpen)}
        className="h-6 w-6 p-0"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* View Toggle */}
      <div className="flex rounded-md border border-border overflow-hidden">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('grid')}
          className="h-6 px-2 rounded-none border-0"
        >
          <Grid3X3 className="h-3 w-3" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('list')}
          className="h-6 px-2 rounded-none border-0 border-l border-border"
        >
          <List className="h-3 w-3" />
        </Button>
      </div>

      {/* Refresh */}
      <Button
        variant="outline"
        size="sm"
        onClick={refreshSensors}
        disabled={sensorsLoading}
        className="h-6 w-6 p-0"
      >
        <RefreshCw className={`h-4 w-4 ${sensorsLoading ? 'animate-spin' : ''}`} />
      </Button>

      {/* More Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={showOnlineOnly}
            onCheckedChange={setShowOnlineOnly}
          >
            Solo Online
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  // Show error if datalogger not found
  if (!selectedLogger) {
    return (
      <SharedDataloggerLayout title="Datalogger Not Found" actions={headerActions}>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-muted-foreground mb-4">
            Datalogger non trovato o non hai accesso.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna alla Lista
          </Button>
        </div>
      </SharedDataloggerLayout>
    );
  }

  const title = `${selectedLogger.label} - Sensori`;

  return (
    <SharedDataloggerLayout title={title} actions={headerActions}>
      <div className="flex flex-col h-full">
        {/* Search Bar */}
        {isSearchOpen && (
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <Input
              ref={searchInputRef}
              placeholder="Cerca sensori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>
        )}

        {/* Datalogger Info Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge
                variant={selectedLogger.is_online ? "default" : "outline"}
                className={selectedLogger.is_online
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                }
              >
                {selectedLogger.is_online ? "Online" : "Offline"}
              </Badge>
              <span className="text-sm font-mono text-muted-foreground">
                {selectedLogger.serial_number}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Gauge className="h-4 w-4" />
                <span>{selectedLogger.active_sensors_count}/{selectedLogger.sensors_count} sensori</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                <span>{selectedLogger.uptime_percentage.toFixed(1)}% uptime</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {sensorsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !filteredSensors?.length ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? 'Nessun sensore trovato' : 'Nessun sensore disponibile'}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid-responsive-sensors' : 'grid-responsive-list'}>
              {filteredSensors.map((sensor) => (
                <SensorCard
                  key={sensor.id}
                  sensor={{
                    ...sensor,
                    id: sensor.id.toString()
                  }}
                  onLabelUpdate={handleSensorLabelUpdate}
                  chartOpacity={chartOpacity}
                  showEnhanced={viewMode === 'grid'}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <ContextualStatusBar />
    </SharedDataloggerLayout>
  );
}