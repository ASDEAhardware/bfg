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
  Eye,
  RefreshCw,
  Play,
  Square,
  Calendar
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SchedulerModal } from "@/components/SchedulerModal";
import { toast } from "sonner";
import { useDataloggerControl } from "@/hooks/useDataloggerControl";

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

// Settings Panel Component
function SettingsPanel({
  isOpen,
  onClose,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  showOnlineOnly,
  setShowOnlineOnly,
  chartOpacity,
  setChartOpacity,
  isAdjustingOpacity,
  setIsAdjustingOpacity
}: {
  isOpen: boolean;
  onClose: () => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  showOnlineOnly: boolean;
  setShowOnlineOnly: (enabled: boolean) => void;
  chartOpacity: number;
  setChartOpacity: (opacity: number) => void;
  isAdjustingOpacity: boolean;
  setIsAdjustingOpacity: (adjusting: boolean) => void;
}) {
  return (
    <>
      {!isAdjustingOpacity && (
        <div
          className={`fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-background border-l border-border shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Settings</h3>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-refresh" className="text-sm font-medium text-foreground">
                Refresh automatico
              </Label>
              <Switch
                id="auto-refresh"
                checked={autoRefreshEnabled}
                onCheckedChange={setAutoRefreshEnabled}
              />
            </div>

            {/* Solo Online Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="solo-online" className="text-sm font-medium text-foreground">
                Solo Online
              </Label>
              <Switch
                id="solo-online"
                checked={showOnlineOnly}
                onCheckedChange={setShowOnlineOnly}
              />
            </div>

            {/* Chart Opacity Slider */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Opacità Grafici: {chartOpacity}%
              </Label>
              <div className="relative">
                {/* Custom slider track */}
                <div className="w-full h-2 bg-muted rounded-lg relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-primary rounded-lg transition-all duration-150"
                    style={{ width: `${(chartOpacity / 50) * 100}%` }}
                  />
                </div>
                {/* Invisible input over the track */}
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={chartOpacity}
                  onChange={(e) => setChartOpacity(parseInt(e.target.value))}
                  onMouseDown={() => setIsAdjustingOpacity(true)}
                  onMouseUp={() => setIsAdjustingOpacity(false)}
                  onTouchStart={() => setIsAdjustingOpacity(true)}
                  onTouchEnd={() => setIsAdjustingOpacity(false)}
                  className="absolute inset-0 w-full h-2 bg-transparent appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                           [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
                           [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10
                           [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background
                           [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none
                           [&::-moz-range-track]:bg-transparent"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Trasparente</span>
                <span>Visibile</span>
              </div>
            </div>
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
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [chartOpacity, setChartOpacity] = useState(20);
  const [isAdjustingOpacity, setIsAdjustingOpacity] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const skeletonTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  /**
   * 
   * @param enabled 
   * Funzione che, al toggle del refresh automatico, chiude la sidebar automaticamente, altrimenti quando il toggle viene disabilitato deve essere chiusa manualmente
   */
  const handleAutoRefreshChange = (enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    if (enabled) {
      setIsSettingsOpen(false);
    }
  };

  // MQTT hooks
  // const { mqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { dataloggers } = useDataloggers(selectedSiteId);

  // Find the current datalogger
  const selectedLogger = dataloggers?.find(d => d.id.toString() === dataloggerId);

  const {
    sensors,
    loading: sensorsLoading,
    refresh: refreshSensors
  } = useSensors(selectedLogger || null);

  // Datalogger control hook
  const {
    session,
    isLogging,
    pendingCommand,
    isPublishing,
    error: controlError,
    sendStart,
    sendStop,
    sendStatus,
    topics,
    handleMqttMessage,
    clearSession,
    clearPending
  } = useDataloggerControl({
    datalogger: selectedLogger || null,
    siteId: selectedSiteId
  });


  // Load chart opacity from localStorage
  useEffect(() => {
    const savedChartOpacity = localStorage.getItem('datalogger-chart-opacity');
    if (savedChartOpacity) {
      setChartOpacity(parseInt(savedChartOpacity));
    }
  }, []);

  // Save chart opacity to localStorage
  useEffect(() => {
    localStorage.setItem('datalogger-chart-opacity', chartOpacity.toString());
  }, [chartOpacity]);

  // Focus search when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Skeleton delay effect - show skeleton only after 600ms of loading
  useEffect(() => {
    if (sensorsLoading && !isAutoRefreshing) {
      // Clear any existing timeout
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }

      // Set skeleton to show after 600ms delay
      skeletonTimeoutRef.current = setTimeout(() => {
        setShowSkeleton(true);
      }, 600);
    } else {
      // Clear timeout and hide skeleton immediately when not loading
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
        skeletonTimeoutRef.current = null;
      }
      setShowSkeleton(false);
    }

    // Cleanup on unmount
    return () => {
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current);
      }
    };
  }, [sensorsLoading, isAutoRefreshing]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !dataloggerId || !selectedLogger?.is_online) return;

    const interval = setInterval(async () => {
      setIsAutoRefreshing(true);
      try {
        await refreshSensors();
      } finally {
        setIsAutoRefreshing(false);
      }
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, dataloggerId, selectedLogger?.is_online, autoRefreshInterval, refreshSensors]);

  // Cleanup pending commands on component unmount
  useEffect(() => {
    return () => {
      clearPending();
    };
  }, []);

  // Filter sensors
  const filteredSensors = sensors?.filter((sensor: Sensor) => {
    const matchesSearch = !searchTerm ||
      sensor.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.sensor_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOnlineFilter = showOnlineOnly ? sensor.is_online : true;
    return matchesSearch && matchesOnlineFilter;
  });

  const handleSensorLabelUpdate = async (sensor: Sensor, newLabel: string) => {
    await refreshSensors();
  };

  // Control functions for start/stop/schedule
  const handleStart = () => {
    setShowStartConfirm(true);
  };

  const confirmStart = async () => {
    setShowStartConfirm(false);
    const success = await sendStart();
    if (success) {
      toast.success("Comando start inviato", {
        description: "In attesa di conferma dal datalogger..."
      });
    }
  };

  const handleStop = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    const success = await sendStop();
    if (success) {
      toast.success("Comando stop inviato", {
        description: "In attesa di conferma dal datalogger..."
      });
    }
  };

  const handleSchedule = () => {
    setShowScheduler(true);
  };

  const handleScheduleSave = (schedule: unknown) => {
    console.log("Schedule saved:", schedule);
    toast.success("Pianificazione salvata");
    setShowScheduler(false);
  };

  const handleBack = () => {
    router.push('/datalogger');
  };

  // Show error if datalogger not found
  if (!selectedLogger) {
    return (
      <div className="flex flex-col h-full">
        {/* Header identical to normal page */}
        <div className="bg-background border-b border-border px-4 py-1">
          <div className="flex flex-col">
            {/* Header row: Back button + Title + Icon */}
            <div className="flex items-center justify-between">
              {/* Left section: Back + Icon + Title */}
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
                <h1 className="text-lg font-semibold">Datalogger Not Found</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content area with centered message */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Videotape className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Datalogger Non Trovato
              </h2>
              <p className="text-muted-foreground">
                Il datalogger richiesto non esiste o non hai i permessi per accedervi.
                Verifica l'URL o contatta l'amministratore.
              </p>
            </div>
          </div>
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
              <div className="flex items-center justify-center w-6 h-6">
                <div
                  className={`w-2 h-2 rounded-full ${
                    selectedLogger?.is_online
                      ? "bg-green-500 animate-pulse"
                      : "bg-orange-500"
                  }`}
                />
              </div>

              {/* Data Acquisition Control Buttons */}
              {selectedLogger?.is_online && (
                <div className="flex items-center gap-1">
                  {/* Start Button */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStart}
                    disabled={isLogging || isPublishing || pendingCommand === 'start' || session?.status === 'unknown'}
                    className={`h-6 w-6 p-0`}
                    title={
                      session?.status === 'unknown'
                        ? "Checking datalogger status..."
                        : isLogging
                          ? "Already logging"
                          : pendingCommand === 'start'
                            ? "Start command sent, waiting for response..."
                            : isPublishing
                              ? "Sending command..."
                              : "Start data acquisition"
                    }
                  >
                    {(isPublishing && pendingCommand === 'start') || pendingCommand === 'start' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : session?.status === 'unknown' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>

                  {/* Stop Button */}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                    disabled={!isLogging || isPublishing || pendingCommand === 'stop' || session?.status === 'unknown'}
                    className={`h-6 w-6 p-0`}
                    title={
                      session?.status === 'unknown'
                        ? "Checking datalogger status..."
                        : !isLogging
                          ? "Not logging"
                          : pendingCommand === 'stop'
                            ? "Stop command sent, waiting for response..."
                            : isPublishing
                              ? "Sending command..."
                              : "Stop data acquisition"
                    }
                  >
                    {(isPublishing && pendingCommand === 'stop') || pendingCommand === 'stop' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : session?.status === 'unknown' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Square className="h-3 w-3" />
                    )}
                  </Button>

                  {/* Schedule Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSchedule}
                    className="h-6 px-2 cursor-pointer"
                    title="Schedule data acquisition"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    <span className="text-xs">Pianifica</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Right section: Search, Enhanced, Auto-refresh, Settings */}
            <div className="flex items-center gap-2">
              {/* Search Dropdown */}
              <DropdownMenu open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isSearchOpen ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="p-2">
                    <Input
                      ref={searchInputRef}
                      placeholder="Cerca sensori..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Enhanced data toggle */}
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

              {/* Auto-refresh input or manual refresh button */}
              {autoRefreshEnabled ? (
                <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-md border border-border">
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto</span>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value) || 5)}
                    className="w-12 h-4 text-xs text-center px-1 border-0 bg-transparent text-foreground font-medium"
                    title="Intervallo auto-refresh in secondi"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshSensors}
                  disabled={sensorsLoading}
                  className="h-6 px-2"
                  title="Refresh sensori"
                >
                  {sensorsLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  <span className="text-xs">Refresh</span>
                </Button>
              )}

              {/* Settings Button (3 dots) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="h-6 w-6 p-0"
                title="Impostazioni"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {showSkeleton ? (
          // Loading skeleton - only shown after 600ms delay
          <div className="grid-responsive-sensors">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-lg h-48"></div>
              </div>
            ))}
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
                showEnhanced={showEnhancedSensorData}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        autoRefreshEnabled={autoRefreshEnabled}
        setAutoRefreshEnabled={handleAutoRefreshChange}
        showOnlineOnly={showOnlineOnly}
        setShowOnlineOnly={setShowOnlineOnly}
        chartOpacity={chartOpacity}
        setChartOpacity={setChartOpacity}
        isAdjustingOpacity={isAdjustingOpacity}
        setIsAdjustingOpacity={setIsAdjustingOpacity}
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
              value: !selectedLogger?.is_online
                ? 'Offline'
                : pendingCommand
                  ? `${pendingCommand}...`
                  : isLogging
                    ? 'Logging'
                    : 'Standby',
              color: !selectedLogger?.is_online
                ? 'error'
                : pendingCommand
                  ? 'warning'
                  : isLogging
                    ? 'success'
                    : 'default'
            },
            // Aggiungi info sessione se disponibile
            ...(session?.session_id ? [{
              label: 'Session',
              value: session.session_id.substring(0, 8) + '...',
              color: 'default' as const
            }] : []),
            // Aggiungi info software version se disponibile
            ...(session?.software_version ? [{
              label: 'SW Version',
              value: session.software_version,
              color: 'default' as const
            }] : []),
            // Mostra errori se presenti
            ...(controlError ? [{
              label: 'Error',
              value: 'MQTT Error',
              color: 'error' as const
            }] : [])
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