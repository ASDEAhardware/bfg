"use client";
import React, { useState, useEffect } from "react";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchedulerModal } from "@/components/SchedulerModal";
import { toast } from "sonner";
import { DataloggerCard } from "@/components/DataloggerCard";
import { SensorCard } from "@/components/SensorCard";
import { ContextualStatusBar, useContextualStatusBar } from "@/components/ContextualStatusBar";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useGridStore } from "@/store/gridStore";
import { useUserInfo } from "@/hooks/useAuth";
import { useMqttConnectionStatus, useMqttControl, useDataloggers, useSensors } from "@/hooks/useMqtt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Square,
  Calendar,
  Circle,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  AlertCircle,
  Videotape,
  Activity,
  Gauge,
  MoreHorizontal,
  ArrowLeft,
  Info,
  Eye
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Datalogger {
  id: number;
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
}

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
  total_readings: number;
  min_value_ever?: number;
  max_value_ever?: number;
  first_seen_at?: string;
  last_seen_at?: string;
  uptime_percentage: number;
  consecutive_misses: number;
  created_at: string;
  updated_at: string;
}

export default function DataLoggerPage() {
  const { createCountItems, createFilterItems } = useContextualStatusBar();
  const { selectedSiteId } = useUnifiedSiteContext();
  const { isGridModeEnabled } = useGridStore();
  const { data: userData } = useUserInfo();

  // New MQTT hooks
  const { connection: mqttConnection, isHeartbeatTimeout, refresh: refreshMqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { controlConnection, forceDiscovery } = useMqttControl();
  const { dataloggers, loading: dataloggerLoading, error: dataloggerError, refresh: refreshDataloggers } = useDataloggers(selectedSiteId);

  // Legacy system info - will be removed when Gateway model is integrated
  const systemInfo = null;

  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSensorSearchOpen, setIsSensorSearchOpen] = useState(false);
  const [showSystemInfoModal, setShowSystemInfoModal] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 200); // Match transition duration
    }
  }, [isSearchOpen]);

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5); // secondi
  const [sensorSearchTerm, setSensorSearchTerm] = useState("");

  // States for the selected datalogger view
  const [selectedLogger, setSelectedLogger] = useState<Datalogger | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  // Hook for sensors of the selected datalogger
  const { sensors, loading: sensorsLoading, error: sensorsError, refresh: refreshSensors, updateSensorLabel } = useSensors(selectedLogger);

  // Stati per conferme azioni critiche
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showEnhancedSensorData, setShowEnhancedSensorData] = useState(false);

  // Hook per rilevare la larghezza del container
  const [containerRef, { isMobile, width }] = useContainerWidth();

  // Helper function to get MQTT status badge variant and text
  const getMqttStatusBadge = () => {
    if (!selectedSiteId) return null;

    if (!mqttConnection) {
      return { variant: "secondary" as const, text: "MQTT non configurato", className: "bg-muted text-muted-foreground" };
    }

    switch (mqttConnection.status) {
      case 'connected':
        return { variant: "default" as const, text: "MQTT connesso", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" };
      case 'connecting':
        return { variant: "secondary" as const, text: "MQTT connessione...", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" };
      case 'disconnected':
        return { variant: "outline" as const, text: "MQTT disconnesso", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" };
      case 'error':
        // Enhanced: distingui tra veri errori e heartbeat timeout
        if (isHeartbeatTimeout) {
          return { variant: "secondary" as const, text: "MQTT device offline", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" };
        } else {
          return { variant: "outline" as const, text: "MQTT errore", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" };
        }
      default:
        return { variant: "secondary" as const, text: "MQTT sconosciuto", className: "bg-muted text-muted-foreground" };
    }
  };

  // Filter dataloggers based on search and online status
  const filteredDataloggers = dataloggers.filter(datalogger => {
    const matchesSearch = datalogger.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.datalogger_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.serial_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOnlineFilter = showOnlineOnly ? datalogger.is_online : true;

    return matchesSearch && matchesOnlineFilter;
  });

  const handleConnect = (datalogger: Datalogger) => {
    setSelectedLogger(datalogger);
    setIsConnected(true);
    // Reset search when switching dataloggers
    setSensorSearchTerm("");
    setIsSensorSearchOpen(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsLogging(false);
    setSelectedLogger(null);
    setSensorSearchTerm("");
    setIsSensorSearchOpen(false);
  };

  const handleDataloggerLabelUpdate = async (datalogger: Datalogger, newLabel: string) => {
    // Aggiorna la lista dei datalogger dopo il successo dell'API call
    try {
      await refreshDataloggers();
    } catch (error) {
      console.error('Failed to refresh dataloggers after label update:', error);
    }
  };

  const handleSensorLabelUpdate = async (sensor: Sensor, newLabel: string) => {
    try {
      await updateSensorLabel(sensor, newLabel);
    } catch (error) {
      console.error('Failed to update sensor label:', error);
      // The hook will handle the error state
    }
  };

  // Filter sensors based on search term
  const filteredSensors = sensors.filter(sensor =>
    sensor.label?.toLowerCase().includes(sensorSearchTerm.toLowerCase()) ||
    sensor.sensor_type?.toLowerCase().includes(sensorSearchTerm.toLowerCase()) ||
    sensor.serial_number?.toLowerCase().includes(sensorSearchTerm.toLowerCase())
  );

  // Reset everything when site changes
  React.useEffect(() => {
    // If we're connected to a datalogger and site changes, disconnect and reset
    if (isConnected) {
      setIsConnected(false);
      setIsLogging(false);
      setSelectedLogger(null);
      // Reset sensors when changing sites - handled by useSensors hook
      setSensorSearchTerm("");
    }
    // Reset search terms and states when site changes
    setSearchTerm("");
    setShowOnlineOnly(false);
    setIsSearchOpen(false);
    setIsSensorSearchOpen(false);
  }, [selectedSiteId]);


  // Auto-refresh sensors with configurable interval when connected and auto-refresh is enabled
  React.useEffect(() => {
    if (!isConnected || !selectedLogger || !autoRefreshEnabled || !selectedLogger.is_online || autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      refreshSensors();
    }, autoRefreshInterval * 1000); // Convert seconds to milliseconds

    return () => clearInterval(interval);
  }, [isConnected, selectedLogger, autoRefreshEnabled, autoRefreshInterval, refreshSensors]);

  const handleStart = () => {
    setShowStartConfirm(true);
  };

  const confirmStart = () => {
    setIsLogging(true);
    setShowStartConfirm(false);
  };

  const handleStop = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = () => {
    setIsLogging(false);
    setShowStopConfirm(false);
  };

  const handleSchedule = () => {
    setShowScheduler(true);
  };

  const handleScheduleSave = (schedule: unknown) => {
    console.log("Schedule saved:", schedule);
    // Qui andrà la logica per salvare la pianificazione
  };

  // MQTT Control Functions (superuser only)
  const handleMqttStart = async () => {
    if (!selectedSiteId || !userData?.is_superuser || startLoading) return;

    setStartLoading(true);
    toast.loading("Starting MQTT connection...", { id: "mqtt-control" });

    try {
      const result = await controlConnection(selectedSiteId, 'start');

      if (result.success) {
        toast.success(`✅ MQTT Started`, {
          id: "mqtt-control",
          description: result.message
        });

        // Refresh states after successful start
        setTimeout(async () => {
          await Promise.all([
            refreshMqttStatus(),
            refreshDataloggers()
          ]);
        }, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(`❌ Failed to start MQTT`, {
        id: "mqtt-control",
        description: error instanceof Error ? error.message : 'Connection error'
      });
      // Refresh even on error to get updated status
      setTimeout(async () => {
        await refreshMqttStatus();
      }, 500);
    } finally {
      setStartLoading(false);
    }
  };

  const handleMqttStop = async () => {
    if (!selectedSiteId || !userData?.is_superuser || stopLoading) return;

    setStopLoading(true);
    toast.loading("Stopping MQTT connection...", { id: "mqtt-control" });

    try {
      const result = await controlConnection(selectedSiteId, 'stop');

      if (result.success) {
        toast.success(`🛑 MQTT Stopped`, {
          id: "mqtt-control",
          description: result.message
        });

        // Refresh states after successful stop
        setTimeout(async () => {
          await Promise.all([
            refreshMqttStatus(),
            refreshDataloggers()
          ]);
        }, 3000);

        // Additional refresh after more time
        setTimeout(async () => {
          await refreshMqttStatus();
        }, 6000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(`❌ Failed to stop MQTT`, {
        id: "mqtt-control",
        description: error instanceof Error ? error.message : 'Connection error'
      });
      // Refresh even on error to get updated status
      setTimeout(async () => {
        await refreshMqttStatus();
      }, 500);
    } finally {
      setStopLoading(false);
    }
  };

  // Force Discovery Function
  const handleForceDiscovery = async () => {
    if (!selectedSiteId || !userData?.is_superuser || discoveryLoading) return;

    setDiscoveryLoading(true);
    toast.loading("Forcing topic discovery refresh...", { id: "discovery-control" });

    try {
      const result = await forceDiscovery(selectedSiteId);

      if (result.success) {
        toast.success(`🔍 Discovery Refresh Complete`, {
          id: "discovery-control",
          description: `${result.success_count} topics processed successfully` +
            (result.error_count > 0 ? `, ${result.error_count} errors` : '')
        });

        // Refresh everything after successful discovery
        setTimeout(async () => {
          await Promise.all([
            refreshMqttStatus(),
            refreshDataloggers()
          ]);
        }, 1000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(`❌ Discovery refresh failed`, {
        id: "discovery-control",
        description: error instanceof Error ? error.message : 'Discovery error'
      });
    } finally {
      setDiscoveryLoading(false);
    }
  };


  // Show legacy connected view when a datalogger is connected
  if (isConnected && selectedLogger) {
    return (
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Connected Datalogger Interface */}
        <div className="bg-background border-b border-border px-4 py-1">
          <div className="flex flex-col">
            {/* Header row: Back button + Title + Controls - responsive */}
            <div className={`flex items-center ${width < 500 ? 'flex-col gap-2' : 'justify-between'}`}>
              {/* Left section: Back + Title + MQTT Status */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDisconnect}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
                <h1 className="text-lg font-semibold">{selectedLogger?.label}</h1>
                <div className="flex items-center gap-2">
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

                  {/* Data Acquisition Control Buttons */}
                  {selectedLogger?.is_online && (
                    <div className="flex items-center gap-1">
                      {/* Start Button */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleStart}
                        disabled={isLogging}
                        className={`h-6 w-6 p-0 ${!isLogging ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        title={isLogging ? "Already logging" : "Start data acquisition"}
                      >
                        <Play className="h-3 w-3" />
                      </Button>

                      {/* Stop Button */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleStop}
                        disabled={!isLogging}
                        className={`h-6 w-6 p-0 ${isLogging ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        title={!isLogging ? "Not logging" : "Stop data acquisition"}
                      >
                        <Square className="h-3 w-3" />
                      </Button>

                      {/* Schedule Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowScheduler(true)}
                        className="h-6 px-2 cursor-pointer"
                        title="Schedule data acquisition"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        <span className="text-xs">Pianifica</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right section: Search, Enhanced, Refresh */}
              <div className={`flex items-center gap-2 ${width < 500 ? 'w-full justify-center' : ''}`}>
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

                <Button
                  variant={isSensorSearchOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsSensorSearchOpen(!isSensorSearchOpen)}
                  className="h-6 w-6 p-0"
                >
                  <Search className="h-4 w-4" />
                </Button>

                {/* Auto-refresh controls */}
                {selectedLogger?.is_online && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="auto-refresh"
                        checked={autoRefreshEnabled}
                        onCheckedChange={setAutoRefreshEnabled}
                      />
                      <Label htmlFor="auto-refresh" className="text-xs whitespace-nowrap">Auto-refresh</Label>
                    </div>

                    {autoRefreshEnabled ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="300"
                          value={autoRefreshInterval}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value > 0 && value <= 300) {
                              setAutoRefreshInterval(value);
                            }
                          }}
                          className="w-12 h-6 px-2 text-xs border border-border rounded bg-background text-foreground text-center"
                          title="Auto-refresh interval in seconds (1-300)"
                        />
                        <span className="text-xs text-muted-foreground">s</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshSensors}
                        disabled={sensorsLoading}
                        className="h-6 w-6 p-0"
                        title="Manual refresh"
                      >
                        <RefreshCw className={`h-4 w-4 ${sensorsLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </>
                )}

                {/* System Info Button */}
                {systemInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSystemInfoModal(true)}
                    className="h-6 w-6 p-0"
                    title="System Information"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search row - expandable with animation */}
            <div className={`transition-all duration-200 ease-in-out overflow-hidden ${
              isSensorSearchOpen ? 'max-h-12 opacity-100 mt-3' : 'max-h-0 opacity-0'
            }`}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca sensori..."
                  value={sensorSearchTerm}
                  onChange={(e) => setSensorSearchTerm(e.target.value)}
                  className="pl-10"
                  autoFocus={isSensorSearchOpen}
                />
              </div>
            </div>
          </div>
        </div>

      <div className="flex-1 overflow-auto p-4 pb-8">
        {!isConnected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nessun acquisitore connesso
              </h3>
              <p className="text-sm text-muted-foreground">
                Seleziona un acquisitore dal menu a tendina e clicca su Connetti per iniziare.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Sensors Grid */}
            {sensorsLoading && sensors.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Caricamento sensori...</p>
                </div>
              </div>
            ) : sensorsError ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
                  <p className="text-sm text-destructive">{sensorsError}</p>
                </div>
              </div>
            ) : filteredSensors.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Gauge className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {sensors.length === 0 ? 'Nessun sensore configurato' : 'Nessun sensore trovato'}
                  </p>
                  {sensors.length > 0 && sensorSearchTerm && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Prova a modificare il termine di ricerca
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid-responsive-sensors">
                {filteredSensors.map((sensor) => (
                  <SensorCard
                    key={sensor.id}
                    sensor={sensor}
                    onLabelUpdate={handleSensorLabelUpdate}
                    showEnhanced={showEnhancedSensorData}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sensors Status Bar - only when connected and not in grid mode */}
      {isConnected && selectedLogger && !isGridModeEnabled && (
        <ContextualStatusBar
          leftItems={[
            { label: 'Datalogger', value: selectedLogger.label },
            { label: 'Sensori', value: sensors.length },
            { label: 'Online', value: sensors.filter(s => s.is_online).length, color: 'success' },
            { label: 'Offline', value: sensors.filter(s => !s.is_online).length, color: sensors.filter(s => !s.is_online).length > 0 ? 'error' : 'default' }
          ]}
          rightItems={[
            ...(sensorSearchTerm ? [{ label: 'Filtrati', value: filteredSensors.length }] : []),
            // Add sensor statistics similar to main page
            ...(sensors.length > 0 ? [
              {
                label: 'Total Readings',
                value: (() => {
                  const total = sensors.reduce((sum, s) => sum + s.total_readings, 0);
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
              value: !selectedLogger?.is_online ? 'Offline' : isLogging ? 'Logging' : 'Standby',
              color: !selectedLogger?.is_online ? 'error' : isLogging ? 'success' : 'warning'
            }
          ]}
        />
      )}

      {/* Dialog di conferma per Start */}
      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avviare acquisizione dati?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per avviare l&apos;acquisizione dati dall&apos;acquisitore &quot;{selectedLogger?.label}&quot;.
              L&apos;operazione verrà eseguita immediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStart}>Avvia</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog di conferma per Stop */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fermare acquisizione dati?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per fermare l&apos;acquisizione dati in corso. Tutti i dati non salvati potrebbero andare persi.
              Vuoi continuare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


        {/* Modal di pianificazione */}
        <SchedulerModal
          open={showScheduler}
          onOpenChange={setShowScheduler}
          onSave={handleScheduleSave}
        />
      </div>
    );
  }

  // Main dashboard view
  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Dashboard Header */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          {/* Header row: Title + Controls - responsive */}
          <div className={`flex items-center ${width < 500 ? 'flex-col gap-2' : 'justify-between'}`}>
            {/* Left section: Icon + Title + MQTT Status */}
            <div className="flex items-center gap-3">
              <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">Datalogger</h1>
              {(() => {
                const status = getMqttStatusBadge();
                return status && (
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} className={`text-xs h-6 flex items-center ${status.className}`}>
                      {status.text}
                    </Badge>
                    {/* MQTT Control Buttons (superuser only) */}
                    {userData?.is_superuser && selectedSiteId && (
                      <div className="flex items-center gap-1">
                        {/* Start Button */}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleMqttStart}
                          disabled={startLoading || stopLoading || mqttConnection?.status === 'connected' || mqttConnection?.status === 'connecting'}
                          className={`h-6 w-6 p-0 ${!(startLoading || stopLoading || mqttConnection?.status === 'connected' || mqttConnection?.status === 'connecting') ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                          title={
                            startLoading
                              ? "Starting connection..."
                              : stopLoading
                                ? "Stop operation in progress..."
                                : mqttConnection?.status === 'connected'
                                  ? "Already connected"
                                  : mqttConnection?.status === 'connecting'
                                    ? "Connection in progress..."
                                    : "Start MQTT connection"
                          }
                        >
                          {startLoading ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>

                        {/* Stop Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleMqttStop}
                          disabled={startLoading || stopLoading || mqttConnection?.status !== 'connected'}
                          className={`h-6 w-6 p-0 ${!(startLoading || stopLoading || mqttConnection?.status !== 'connected') ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                          title={
                            stopLoading
                              ? "Stopping connection..."
                              : startLoading
                                ? "Start operation in progress..."
                                : mqttConnection?.status !== 'connected'
                                  ? "Not connected"
                                  : "Stop MQTT connection"
                          }
                        >
                          {stopLoading ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Square className="h-3 w-3" />
                          )}
                        </Button>

                        {/* Discovery Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleForceDiscovery}
                          disabled={startLoading || stopLoading || discoveryLoading}
                          className={`h-6 px-2 ${!(startLoading || stopLoading || discoveryLoading) ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                          title={
                            discoveryLoading
                              ? "Discovery refresh in progress..."
                              : startLoading || stopLoading
                                ? "MQTT operation in progress..."
                                : "Force topic discovery refresh"
                          }
                        >
                          {discoveryLoading ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Search className="h-3 w-3 mr-1" />
                          )}
                          <span className="text-xs">Discover</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Right section: All controls - responsive layout */}
            <div className={`flex items-center gap-2 ${width < 500 ? 'w-full justify-center' : ''}`}>
              {/* Switch - hide on very small screens */}
              {width >= 400 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="online-only"
                    checked={showOnlineOnly}
                    onCheckedChange={setShowOnlineOnly}
                  />
                  <Label htmlFor="online-only" className={`text-xs whitespace-nowrap ${isMobile ? 'sr-only' : ''}`}>Solo online</Label>
                </div>
              )}

              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none h-6 w-6 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none h-6 w-6 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant={isSearchOpen ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="h-6 w-6 p-0"
              >
                <Search className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={refreshDataloggers}
                disabled={dataloggerLoading}
                className={`h-6 ${width < 350 ? 'w-6 p-0' : 'px-3'}`}
              >
                <RefreshCw className={`h-4 w-4 ${dataloggerLoading ? 'animate-spin' : ''}`} />
                {width >= 350 && !isMobile && <span className="ml-2 text-xs">Aggiorna</span>}
              </Button>

              {/* System Info Button */}
              {systemInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemInfoModal(true)}
                  className="h-6 w-6 p-0"
                  title="System Information"
                >
                  <Info className="h-4 w-4" />
                </Button>
              )}

              {/* More menu for hidden controls on very small screens */}
              {width < 400 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                      checked={showOnlineOnly}
                      onCheckedChange={setShowOnlineOnly}
                    >
                      Solo online
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Search row - expandable with animation and proper spacing */}
          <div className={`transition-all duration-200 ease-in-out overflow-hidden ${
            isSearchOpen ? 'max-h-12 opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Cerca datalogger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto p-4 pb-8">
        {!selectedSiteId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Videotape className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nessun sito selezionato
              </h3>
              <p className="text-sm text-muted-foreground">
                Seleziona un sito dal menu in alto per visualizzare i datalogger
              </p>
            </div>
          </div>
        ) : dataloggerLoading ? (
          <div className={
            viewMode === 'grid'
              ? (width < 600 ? 'grid-responsive-cards-container' : 'grid-responsive-cards')
              : 'grid-responsive-list'
          }>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card-standard">
                <div className="card-content-detailed">
                  {viewMode === 'list' ? (
                    // Skeleton per modalità lista (compact)
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="skeleton-shimmer h-5 w-32"></div>
                          <div className="skeleton-shimmer h-5 w-16"></div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="skeleton-shimmer h-3 w-24"></div>
                          <div className="skeleton-shimmer h-3 w-20"></div>
                          <div className="skeleton-shimmer h-3 w-28 hidden sm:block"></div>
                        </div>
                      </div>
                      <div className="hidden lg:flex items-center gap-6">
                        <div className="skeleton-shimmer h-3 w-8"></div>
                        <div className="skeleton-shimmer h-3 w-12"></div>
                        <div className="skeleton-shimmer h-3 w-16"></div>
                      </div>
                      <div className="skeleton-shimmer h-8 w-20"></div>
                    </div>
                  ) : (
                    // Skeleton per modalità griglia (full)
                    <>
                      <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="min-w-0 flex-1">
                          <div className="skeleton-shimmer h-6 w-40 mb-2"></div>
                        </div>
                        <div className="skeleton-shimmer h-6 w-16"></div>
                      </div>
                      <div className="space-y-2 mb-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="skeleton-shimmer h-4 w-4"></div>
                            <div className="skeleton-shimmer h-3 w-12"></div>
                            <div className="skeleton-shimmer h-3 w-24"></div>
                          </div>
                        ))}
                      </div>
                      <div className="skeleton-shimmer h-10 w-full"></div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : dataloggerError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-medium text-destructive mb-2">
                Errore nel caricamento
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {dataloggerError}
              </p>
              <Button onClick={refreshDataloggers} variant="outline">
                Riprova
              </Button>
            </div>
          </div>
        ) : filteredDataloggers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Videotape className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {dataloggers.length === 0 ? 'Nessun datalogger trovato' : 'Nessun risultato'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {dataloggers.length === 0
                  ? 'Non ci sono datalogger configurati per questo sito'
                  : 'Prova a modificare i filtri di ricerca'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? (width < 600 ? 'grid-responsive-cards-container' : 'grid-responsive-cards')
              : 'grid-responsive-list'
          }>
            {filteredDataloggers.map((datalogger) => (
              <DataloggerCard
                key={datalogger.id}
                datalogger={datalogger}
                onConnect={handleConnect}
                onLabelUpdate={handleDataloggerLabelUpdate}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contextual Status Bar - only when not in grid mode */}
      {!isGridModeEnabled && (
        <ContextualStatusBar
          leftItems={createCountItems(
            dataloggers.length,
            dataloggers.filter(d => d.is_online).length,
            dataloggers.filter(d => !d.is_online).length
          )}
          rightItems={[
            ...createFilterItems(filteredDataloggers.length, searchTerm),
            // Add datalogger stats
            ...(dataloggers.length > 0 ? [
              {
                label: 'Total Sensors',
                value: dataloggers.reduce((sum, d) => sum + d.sensors_count, 0),
                color: 'default' as const
              },
              {
                label: 'Total Messages',
                value: (() => {
                  const total = dataloggers.reduce((sum, d) => sum + d.total_heartbeats, 0);
                  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`;
                  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
                  return total;
                })(),
                color: 'default' as const
              },
              {
                label: 'Avg Uptime',
                value: `${(dataloggers.reduce((sum, d) => sum + d.uptime_percentage, 0) / dataloggers.length).toFixed(1)}%`,
                color: (dataloggers.reduce((sum, d) => sum + d.uptime_percentage, 0) / dataloggers.length) >= 90 ? 'success' as const : 'warning' as const
              }
            ] : []),
            // Add system info to the right side if available
            ...(systemInfo ? [
              {
                label: systemInfo.label || systemInfo.os_version || 'Gateway',
                icon: Activity,
                color: systemInfo.is_online ? 'success' as const : 'error' as const
              },
              ...(systemInfo.cpu_usage_percent !== undefined && systemInfo.cpu_usage_percent !== null ? [{
                label: `CPU ${systemInfo.cpu_usage_percent.toFixed(1)}%`
              }] : []),
              ...(systemInfo.memory_usage_percent !== undefined && systemInfo.memory_usage_percent !== null ? [{
                label: `RAM ${systemInfo.memory_usage_percent.toFixed(1)}%`
              }] : []),
              ...(systemInfo.disk_usage_percent !== undefined && systemInfo.disk_usage_percent !== null ? [{
                label: `Disk ${systemInfo.disk_usage_percent.toFixed(1)}%`
              }] : []),
              {
                label: `Updated ${new Date(systemInfo.updated_at || systemInfo.last_updated || '').toLocaleTimeString()}`
              }
            ] : [])
          ]}
        />
      )}

      {/* System Info Modal */}
      <Dialog open={showSystemInfoModal} onOpenChange={setShowSystemInfoModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Gateway Information - {systemInfo?.hostname || systemInfo?.label}
            </DialogTitle>
            <DialogDescription>
              Complete system details and performance metrics
            </DialogDescription>
          </DialogHeader>

          {systemInfo && (
            <div className="space-y-6">
              {/* System Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Gateway Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial Number:</span>
                      <span className="font-mono">{systemInfo.serial_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Label:</span>
                      <span className="font-mono">{systemInfo.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hostname:</span>
                      <span className="font-mono">{systemInfo.hostname || 'Unknown'}</span>
                    </div>
                    {systemInfo.ip_address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IP Address:</span>
                        <span className="font-mono">{systemInfo.ip_address}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MAC Address:</span>
                      <span className="font-mono">{systemInfo.mac_address || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OS:</span>
                      <span>{systemInfo.os_name || 'Unknown'} {systemInfo.os_version || ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kernel:</span>
                      <span className="font-mono">{systemInfo.kernel_version || 'Unknown'}</span>
                    </div>
                    {systemInfo.firmware_version && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Firmware:</span>
                        <span className="font-mono">{systemInfo.firmware_version}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Python:</span>
                      <span className="font-mono">{systemInfo.python_version || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                {/* Hardware section - only show if we have data */}
                {(systemInfo.cpu_model || systemInfo.cpu_cores || systemInfo.cpu_frequency || systemInfo.total_memory || systemInfo.total_storage) && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Hardware</h3>
                    <div className="space-y-2 text-sm">
                      {systemInfo.cpu_model && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPU:</span>
                          <span>{systemInfo.cpu_model}</span>
                        </div>
                      )}
                    {systemInfo.cpu_cores && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cores:</span>
                        <span>{systemInfo.cpu_cores}</span>
                      </div>
                    )}
                    {systemInfo.cpu_frequency && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span>{systemInfo.cpu_frequency.toFixed(0)} MHz</span>
                      </div>
                    )}
                    {systemInfo.total_memory && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Memory:</span>
                        <span>{(systemInfo.total_memory / (1024**3)).toFixed(2)} GB</span>
                      </div>
                    )}
                    {systemInfo.total_storage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Storage:</span>
                        <span>{(systemInfo.total_storage / (1024**3)).toFixed(2)} GB</span>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Metrics */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {systemInfo.cpu_usage_percent !== undefined && systemInfo.cpu_usage_percent !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">CPU Usage</div>
                      <div className="text-2xl font-semibold">{systemInfo.cpu_usage_percent.toFixed(1)}%</div>
                      <div className="w-full bg-background rounded-full h-2 mt-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${Math.min(systemInfo.cpu_usage_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {systemInfo.memory_usage_percent !== undefined && systemInfo.memory_usage_percent !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Memory Usage</div>
                      <div className="text-2xl font-semibold">{systemInfo.memory_usage_percent.toFixed(1)}%</div>
                      <div className="w-full bg-background rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(systemInfo.memory_usage_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {systemInfo.disk_usage_percent !== undefined && systemInfo.disk_usage_percent !== null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Disk Usage</div>
                      <div className="text-2xl font-semibold">{systemInfo.disk_usage_percent.toFixed(1)}%</div>
                      <div className="w-full bg-background rounded-full h-2 mt-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full"
                          style={{ width: `${Math.min(systemInfo.disk_usage_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Uptime and Temperature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemInfo.uptime_seconds && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Uptime</h3>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-semibold">
                        {(() => {
                          const days = Math.floor(systemInfo.uptime_seconds / 86400);
                          const hours = Math.floor((systemInfo.uptime_seconds % 86400) / 3600);
                          const minutes = Math.floor((systemInfo.uptime_seconds % 3600) / 60);

                          if (days > 0) return `${days}d ${hours}h ${minutes}m`;
                          if (hours > 0) return `${hours}h ${minutes}m`;
                          return `${minutes}m`;
                        })()}
                      </div>
                      {systemInfo.boot_time && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Boot time: {new Date(systemInfo.boot_time).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {systemInfo.cpu_temperature && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Temperature</h3>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-semibold">{systemInfo.cpu_temperature.toFixed(1)}°C</div>
                      <div className="text-sm text-muted-foreground">CPU Temperature</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Network Interfaces */}
              {systemInfo.network_interfaces && Object.keys(systemInfo.network_interfaces).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Network Interfaces</h3>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(systemInfo.network_interfaces, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Installed Packages */}
              {systemInfo.installed_packages && systemInfo.installed_packages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Installed Packages ({systemInfo.installed_packages.length})</h3>
                  <div className="bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 text-xs font-mono">
                      {systemInfo.installed_packages.map((pkg, index) => (
                        <div key={index}>{pkg}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                Last updated: {new Date(systemInfo.updated_at || systemInfo.last_updated || '').toLocaleString()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}