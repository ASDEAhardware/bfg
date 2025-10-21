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
  Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/axios";
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
  id: string;
  name: string;
  serial_number: string;
  model: string;
  firmware_version?: string;
  ip_address?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  is_active: boolean;
  last_communication?: string;
  site_name: string;
  sensors_count: number;
  active_sensors_count: number;
}

interface Sensor {
  id: string;
  name: string;
  sensor_type: string;
  channel: number;
  unit_of_measure?: string;
  min_value?: number;
  max_value?: number;
  status: 'active' | 'inactive' | 'calibrating' | 'error' | 'maintenance';
  is_active: boolean;
  last_reading?: string;
  current_value?: number;
  description?: string;
}

export default function DataLoggerPage() {
  const { createCountItems, createFilterItems } = useContextualStatusBar();
  const { selectedSiteId } = useUnifiedSiteContext();
  const { isGridModeEnabled } = useGridStore();
  const { data: userData } = useUserInfo();

  // New MQTT hooks
  const { connection: mqttConnection, isHeartbeatTimeout, refresh: refreshMqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { controlConnection } = useMqttControl();
  const { dataloggers, loading: dataloggerLoading, error: dataloggerError, refresh: refreshDataloggers, updateDataloggerLabel } = useDataloggers(selectedSiteId);

  // Legacy system info - will be removed when Gateway model is integrated
  const systemInfo = null;

  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
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

  // Sensors states
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [sensorsError, setSensorsError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [sensorSearchTerm, setSensorSearchTerm] = useState("");

  // Legacy states for the connected datalogger view
  const [selectedLogger, setSelectedLogger] = useState<Datalogger | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

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
      return { variant: "secondary" as const, text: "🔌 Non configurato", className: "bg-muted text-muted-foreground" };
    }

    switch (mqttConnection.status) {
      case 'connected':
        return { variant: "default" as const, text: "🟢 Connesso", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" };
      case 'connecting':
        return { variant: "secondary" as const, text: "🟡 Connessione...", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" };
      case 'disconnected':
        return { variant: "outline" as const, text: "🔴 Disconnesso", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" };
      case 'error':
        // Enhanced: distingui tra veri errori e heartbeat timeout
        if (isHeartbeatTimeout) {
          return { variant: "secondary" as const, text: "🟡 Device offline", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" };
        } else {
          return { variant: "outline" as const, text: "🔴 Errore", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" };
        }
      default:
        return { variant: "secondary" as const, text: "❓ Sconosciuto", className: "bg-muted text-muted-foreground" };
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
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsLogging(false);
    setSelectedLogger(null);
    setSensors([]);
    setSensorSearchTerm("");
    setIsSensorSearchOpen(false);
  };

  const handleDataloggerLabelUpdate = (datalogger: any, newLabel: string) => {
    // Aggiorna la lista locale dei datalogger
    setDataloggers(prev => prev.map(dl =>
      dl.id === datalogger.id
        ? { ...dl, name: newLabel }
        : dl
    ));

    // Se è il datalogger selezionato, aggiorna anche quello
    if (selectedLogger && selectedLogger.id === datalogger.id) {
      setSelectedLogger(prev => prev ? { ...prev, name: newLabel } : null);
    }
  };

  const handleSensorLabelUpdate = (sensor: any, newLabel: string) => {
    // Aggiorna la lista locale dei sensori
    setSensors(prev => prev.map(s =>
      s.id === sensor.id
        ? { ...s, name: newLabel }
        : s
    ));
  };

  // Filter sensors based on search term
  const filteredSensors = sensors.filter(sensor =>
    sensor.name.toLowerCase().includes(sensorSearchTerm.toLowerCase()) ||
    sensor.sensor_type.toLowerCase().includes(sensorSearchTerm.toLowerCase()) ||
    sensor.channel.toString().includes(sensorSearchTerm)
  );

  // Reset everything when site changes
  React.useEffect(() => {
    // If we're connected to a datalogger and site changes, disconnect and reset
    if (isConnected) {
      setIsConnected(false);
      setIsLogging(false);
      setSelectedLogger(null);
      setSensors([]);
      setSensorSearchTerm("");
    }
    // Reset search terms and states when site changes
    setSearchTerm("");
    setShowOnlineOnly(false);
    setIsSearchOpen(false);
    setIsSensorSearchOpen(false);
  }, [selectedSiteId]);


  // Auto-refresh sensors every 10 seconds when connected and auto-refresh is enabled
  React.useEffect(() => {
    if (!isConnected || !selectedLogger || !autoRefreshEnabled) return;

    const interval = setInterval(() => {
      fetchSensors(selectedLogger);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isConnected, selectedLogger, autoRefreshEnabled]);

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

  const handleScheduleSave = (schedule: any) => {
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
        }, 1000);
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


  // Show legacy connected view when a datalogger is connected
  if (isConnected && selectedLogger) {
    return (
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Connected Datalogger Interface */}
        <div className="bg-background border-b border-border px-4 py-2">
          <div className="flex flex-col">
            {/* Header row: Back button + Title + Controls - responsive */}
            <div className={`flex items-center ${width < 500 ? 'flex-col gap-2' : 'justify-between'}`}>
              {/* Left section: Back + Device Info */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDisconnect}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
                <h1 className="text-lg font-semibold truncate">{selectedLogger?.name}</h1>
                {width >= 400 && !isMobile && (
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {selectedLogger?.model}
                  </Badge>
                )}
                {/* Status indicators - minimal visual indicators */}
                {width >= 400 && (
                  <div className="flex items-center gap-2">
                    <Circle className="h-2 w-2 fill-current text-green-500 animate-pulse" />
                    {isLogging && (
                      <Circle className="h-2 w-2 fill-current text-blue-500 animate-pulse" />
                    )}
                  </div>
                )}
              </div>

              {/* Right section: Control Buttons - responsive */}
              <div className={`flex items-center gap-2 ${width < 500 ? 'w-full justify-center' : ''}`}>
                <Button
                  onClick={handleStart}
                  disabled={isLogging}
                  size="sm"
                  variant="default"
                  className={`flex items-center gap-1 h-8 ${width < 400 ? 'w-8 p-0' : ''}`}
                >
                  <Play className="h-4 w-4" />
                  {width >= 400 && <span>Start</span>}
                </Button>

                <Button
                  onClick={handleStop}
                  disabled={!isLogging}
                  size="sm"
                  variant="destructive"
                  className={`flex items-center gap-1 h-8 ${width < 400 ? 'w-8 p-0' : ''}`}
                >
                  <Square className="h-4 w-4" />
                  {width >= 400 && <span>Stop</span>}
                </Button>

                {width >= 500 && (
                  <Button
                    onClick={handleSchedule}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1 h-8"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Pianifica</span>
                  </Button>
                )}

                <Button
                  variant={isSensorSearchOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsSensorSearchOpen(!isSensorSearchOpen)}
                  className="h-8 w-8 p-0"
                >
                  <Search className="h-4 w-4" />
                </Button>

                <Button
                  variant={showEnhancedSensorData ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowEnhancedSensorData(!showEnhancedSensorData)}
                  className="h-8 px-3"
                  title="Toggle enhanced sensor data view"
                >
                  <Activity className="h-4 w-4 mr-1" />
                  <span className="text-xs">Enhanced</span>
                </Button>

                {/* System Info Button */}
                {systemInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSystemInfoModal(true)}
                    className="h-8 w-8 p-0"
                    title="System Information"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                )}

                {/* More menu for hidden controls on very small screens */}
                {width < 500 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuCheckboxItem
                        disabled={isLogging}
                        onClick={handleSchedule}
                      >
                        Pianifica
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            {/* Sensors Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">
                  Sensori - {selectedLogger?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isLogging ? "Acquisizione dati in corso..." : "Monitoraggio sensori attivo"}
                  {autoRefreshEnabled && " • Aggiornamento automatico ogni 10s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className="h-8"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  {autoRefreshEnabled ? "Auto" : "Manuale"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedLogger && fetchSensors(selectedLogger)}
                  disabled={sensorsLoading}
                  className="h-8"
                >
                  <RefreshCw className={`h-4 w-4 ${sensorsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

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
              <div className="grid-responsive-cards">
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
            { label: 'Datalogger', value: selectedLogger.name },
            { label: 'Sensori', value: sensors.length },
            { label: 'Attivi', value: sensors.filter(s => s.status === 'active').length, color: 'success' },
            { label: 'Offline', value: sensors.filter(s => s.status !== 'active').length, color: sensors.filter(s => s.status !== 'active').length > 0 ? 'error' : 'default' }
          ]}
          rightItems={[
            ...(sensorSearchTerm ? [{ label: 'Filtrati', value: filteredSensors.length }] : []),
            { label: 'Auto-refresh', value: autoRefreshEnabled ? 'ON' : 'OFF', color: autoRefreshEnabled ? 'success' : 'default' },
            { label: 'Stato', value: isLogging ? 'Logging' : 'Standby', color: isLogging ? 'success' : 'warning' }
          ]}
        />
      )}

      {/* Dialog di conferma per Start */}
      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avviare acquisizione dati?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per avviare l'acquisizione dati dall'acquisitore "{selectedLogger?.name}".
              L'operazione verrà eseguita immediatamente.
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
              Stai per fermare l'acquisizione dati in corso. Tutti i dati non salvati potrebbero andare persi.
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
      <div className="bg-background border-b border-border px-4 py-2">
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
                    <Badge variant={status.variant} className={`text-xs ${status.className}`}>
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
                  <Label htmlFor="online-only" className={`text-sm whitespace-nowrap ${isMobile ? 'sr-only' : ''}`}>Solo online</Label>
                </div>
              )}

              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none h-8 w-8 p-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant={isSearchOpen ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="h-8 w-8 p-0"
              >
                <Search className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={refreshDataloggers}
                disabled={dataloggerLoading}
                className={`h-8 ${width < 350 ? 'w-8 p-0' : 'px-3'}`}
              >
                <RefreshCw className={`h-4 w-4 ${dataloggerLoading ? 'animate-spin' : ''}`} />
                {width >= 350 && !isMobile && <span className="ml-2">Aggiorna</span>}
              </Button>

              {/* System Info Button */}
              {systemInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemInfoModal(true)}
                  className="h-8 w-8 p-0"
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
                      className="h-8 w-8 p-0"
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
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Caricamento datalogger...
              </h3>
              <p className="text-sm text-muted-foreground">
                Attendere prego
              </p>
            </div>
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
            dataloggers.filter(d => d.status === 'active').length,
            dataloggers.filter(d => d.status !== 'active').length
          )}
          rightItems={[
            ...createFilterItems(filteredDataloggers.length, searchTerm),
            // Add MQTT device status indicators
            ...(dataloggers.length > 0 ? [
              {
                label: `MQTT Online: ${dataloggers.filter(d => d.is_active).length}`,
                color: 'success' as const
              },
              ...(dataloggers.filter(d => !d.is_active).length > 0 ? [{
                label: `MQTT Offline: ${dataloggers.filter(d => !d.is_active).length}`,
                color: 'error' as const
              }] : [])
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