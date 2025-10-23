"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SensorCard } from "@/components/SensorCard";
import { ContextualStatusBar } from "@/components/ContextualStatusBar";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useMqttConnectionStatus, useDataloggers, useSensors } from "@/hooks/useMqtt";
import {
  ArrowLeft,
  Search,
  Grid3X3,
  List,
  Settings,
  X,
  MoreHorizontal,
  Activity,
  Gauge,
  Videotape,
  Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  latest_readings?: { timestamp: string; data: Record<string, any> }[];
  current_value?: number;
  datalogger_label: string;
  site_name: string;
  total_messages: number;
  total_readings?: number;
  missed_messages: number;
  uptime_percentage: number;
  created_at: string;
  updated_at: string;
}

// Simple Settings Panel
function SettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [chartOpacity, setChartOpacity] = useState(20);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl z-[9999]"
        style={{ transform: 'translateX(0)' }}
      >
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Impostazioni</h3>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          <div>
            <h4 className="font-medium mb-2">Opacità Grafici: {chartOpacity}%</h4>
            <input
              type="range"
              min="0"
              max="50"
              value={chartOpacity}
              onChange={(e) => setChartOpacity(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function DataLoggerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dataloggerIdParam = params?.id;
  const dataloggerId = Array.isArray(dataloggerIdParam) ? dataloggerIdParam[0] : dataloggerIdParam;

  const { selectedSiteId } = useUnifiedSiteContext();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showEnhancedSensorData, setShowEnhancedSensorData] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // MQTT hooks
  const { mqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { dataloggers } = useDataloggers(selectedSiteId);
  const {
    sensors,
    loading: sensorsLoading,
    refreshSensors
  } = useSensors(dataloggerId ? parseInt(dataloggerId) : null);

  // Find the current datalogger
  const selectedLogger = dataloggers?.find(d => d.id.toString() === dataloggerId);


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

  const handleBack = () => {
    router.push('/datalogger');
  };

  // Show error if datalogger not found
  if (!selectedLogger) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-background border-b border-border px-4 py-2">
          <h1 className="text-xl font-semibold">Datalogger Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-muted-foreground mb-4">
            Datalogger non trovato o non hai accesso.
          </p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna alla Lista
          </Button>
        </div>
      </div>
    );
  }

  const title = `${selectedLogger.label} - Sensori`;

  return (
    <div className="flex flex-col h-full">
      {/* Connected Datalogger Interface */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          {/* Header row: Back button + Title + Controls */}
          <div className="flex items-center justify-between">
            {/* Left section: Back + Title + Status */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">{selectedLogger?.label}</h1>
              <Badge
                variant={selectedLogger?.is_online ? "default" : "secondary"}
                className={`text-xs h-6 flex items-center ${
                  selectedLogger?.is_online
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                    : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                }`}
              >
                {selectedLogger?.is_online ? "Online" : "Offline"}
              </Badge>
            </div>

            {/* Right section: Enhanced, Search, Auto-refresh, Settings */}
            <div className="flex items-center gap-2">
              <Button
                variant={showEnhancedSensorData ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowEnhancedSensorData(!showEnhancedSensorData)}
                className="h-6 px-2"
                title="Toggle detailed sensor data view"
              >
                <Eye className="h-4 w-4 mr-1" />
                <span className="text-xs">Dettaglio</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={isSettingsOpen}
                    onCheckedChange={setIsSettingsOpen}
                  >
                    Settings
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

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
                chartOpacity={20}
                showEnhanced={viewMode === 'grid'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Sensors Status Bar */}
      {selectedLogger && sensors && (
        <ContextualStatusBar
          leftItems={[
            { label: 'Datalogger', value: selectedLogger.label },
            { label: 'Sensori', value: sensors.length },
            { label: 'Online', value: sensors.filter(s => s.is_online).length, color: 'success' },
            { label: 'Offline', value: sensors.filter(s => !s.is_online).length, color: sensors.filter(s => !s.is_online).length > 0 ? 'error' : 'default' }
          ]}
          rightItems={[
            ...(searchTerm ? [{ label: 'Filtrati', value: filteredSensors?.length || 0 }] : []),
            // Add sensor statistics similar to main page
            ...(sensors.length > 0 ? [
              {
                label: 'Total Readings',
                value: (() => {
                  const total = sensors.reduce((sum, s) => sum + (s.total_readings || 0), 0);
                  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`;
                  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
                  return total;
                })(),
                color: 'default' as const
              },
              {
                label: 'Avg Uptime',
                value: `${(sensors.reduce((sum, s) => sum + s.uptime_percentage, 0) / sensors.length).toFixed(1)}%`,
                color: (sensors.reduce((sum, s) => sum + s.uptime_percentage, 0) / sensors.length) >= 90 ? 'success' as const : 'warning' as const
              }
            ] : []),
            {
              label: 'Stato',
              value: !selectedLogger?.is_online ? 'Offline' : 'Online',
              color: !selectedLogger?.is_online ? 'error' : 'success'
            }
          ]}
        />
      )}
    </div>
  );
}