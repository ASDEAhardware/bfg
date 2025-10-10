"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchedulerModal } from "@/components/SchedulerModal";
import { DataloggerCard } from "@/components/DataloggerCard";
import { SensorCard } from "@/components/SensorCard";
import { ContextualStatusBar, useContextualStatusBar } from "@/components/ContextualStatusBar";
import { useSiteContext } from "@/contexts/SiteContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
  Gauge
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const { selectedSiteId } = useSiteContext();
  const [dataloggers, setDataloggers] = useState<Datalogger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  // Hook per rilevare la larghezza del container
  const [containerRef, { isMobile, isTablet, isDesktop }] = useContainerWidth();

  // Fetch all dataloggers for the selected site
  useEffect(() => {
    const fetchDataloggers = async () => {
      if (!selectedSiteId) {
        setDataloggers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/sites/dataloggers/?site_id=${selectedSiteId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dataloggers');
        }

        const data = await response.json();
        setDataloggers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDataloggers();
  }, [selectedSiteId]);

  // Filter dataloggers based on search and online status
  const filteredDataloggers = dataloggers.filter(datalogger => {
    const matchesSearch = datalogger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.serial_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOnlineFilter = showOnlineOnly ? datalogger.status === 'active' : true;

    return matchesSearch && matchesOnlineFilter;
  });

  // Fetch sensors for connected datalogger
  const fetchSensors = async (datalogger: Datalogger) => {
    if (!datalogger) return;

    setSensorsLoading(true);
    setSensorsError(null);

    try {
      const response = await fetch(`/api/v1/sites/sensors/by-datalogger/${datalogger.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sensors');
      }

      const data = await response.json();
      setSensors(data);
    } catch (err) {
      setSensorsError(err instanceof Error ? err.message : 'Unknown error occurred');
      setSensors([]);
    } finally {
      setSensorsLoading(false);
    }
  };

  const handleConnect = (datalogger: Datalogger) => {
    setSelectedLogger(datalogger);
    setIsConnected(true);
    fetchSensors(datalogger);
  };

  const refreshDataloggers = async () => {
    if (!selectedSiteId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/sites/dataloggers/?site_id=${selectedSiteId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDataloggers(data);
      }
    } catch (err) {
      console.error('Error refreshing dataloggers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = () => {
    setIsConnected(false);
    setIsLogging(false);
    setSelectedLogger(null);
    setSensors([]);
    setSensorSearchTerm("");
    setShowDisconnectConfirm(false);
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

  // Show legacy connected view when a datalogger is connected
  if (isConnected && selectedLogger) {
    return (
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Connected Datalogger Interface */}
        <div className="bg-background border-b border-border px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* Header row: Title + Controls */}
            <div className={`flex ${isDesktop ? 'flex-row gap-4' : 'flex-col gap-3'}`}>
              {/* Left section: Device Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
                <h1 className="text-lg font-semibold truncate">{selectedLogger?.name}</h1>
                {!isMobile && (
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {selectedLogger?.model}
                  </Badge>
                )}
                {/* Status indicators - only on desktop in same row */}
                {isDesktop && (
                  <div className="flex items-center gap-1">
                    <Circle className="h-1.5 w-1.5 fill-current text-green-500 animate-pulse" />
                    <span className="text-xs text-green-600">Connesso</span>
                    {isLogging && (
                      <>
                        <Circle className="h-1.5 w-1.5 fill-current text-blue-500 animate-pulse ml-1" />
                        <span className="text-xs text-blue-600">Logging</span>
                      </>
                    )}
                  </div>
                )}

                {/* Search integrated inline only on desktop */}
                {isDesktop && (
                  <div className="flex relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca sensori..."
                      value={sensorSearchTerm}
                      onChange={(e) => setSensorSearchTerm(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>
                )}
              </div>

              {/* Right section: Control Buttons - always in top row */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleStart}
                  disabled={isLogging}
                  size="sm"
                  variant="default"
                  className="flex items-center gap-1 h-8"
                >
                  <Play className="h-4 w-4" />
                  {!isMobile && <span>Start</span>}
                </Button>

                <Button
                  onClick={handleStop}
                  disabled={!isLogging}
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-1 h-8"
                >
                  <Square className="h-4 w-4" />
                  {!isMobile && <span>Stop</span>}
                </Button>

                {isDesktop && (
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

                <div className="pl-2 ml-2 border-l border-border">
                  <Button
                    onClick={handleDisconnect}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                  >
                    {!isMobile ? <span>Disconnetti</span> : <span>×</span>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Search row - separate row for tablet and mobile */}
            {!isDesktop && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca sensori..."
                  value={sensorSearchTerm}
                  onChange={(e) => setSensorSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
        </div>

      <div className="flex-1 overflow-auto p-6">
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
                  <SensorCard key={sensor.id} sensor={sensor} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sensors Status Bar - only when connected */}
      {isConnected && selectedLogger && (
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

      {/* Dialog di conferma per Disconnetti */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnettere acquisitore?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per disconnettere l'acquisitore "{selectedLogger?.name}".
              Se è in corso un'acquisizione, questa verrà interrotta e i dati non salvati andranno persi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnetti
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
      <div className="bg-background border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Header row: Title + Controls */}
          <div className={`flex ${isDesktop ? 'flex-row gap-4' : 'flex-col gap-3'}`}>
            {/* Left section: Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Videotape className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold truncate">Datalogger</h1>

              {/* Search integrated inline only on desktop */}
              {isDesktop && (
                <div className="flex relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca datalogger..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              )}
            </div>

            {/* Right section: Controls - always in top row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="online-only"
                  checked={showOnlineOnly}
                  onCheckedChange={setShowOnlineOnly}
                />
                {!isMobile && (
                  <Label htmlFor="online-only" className="text-sm whitespace-nowrap">Solo online</Label>
                )}
              </div>

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
                variant="outline"
                size="sm"
                onClick={refreshDataloggers}
                disabled={loading}
                className="h-8 px-3"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {!isMobile && <span className="ml-2">Aggiorna</span>}
              </Button>
            </div>
          </div>

          {/* Search row - separate row for tablet and mobile */}
          {!isDesktop && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca datalogger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
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
        ) : loading ? (
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
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-medium text-destructive mb-2">
                Errore nel caricamento
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {error}
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
              ? `grid-responsive-cards ${
                  isMobile ? 'grid-cols-1' :
                  isTablet ? 'grid-cols-2' :
                  isDesktop ? 'grid-cols-3' :
                  'grid-cols-4'
                }`
              : 'grid-responsive-list'
          }>
            {filteredDataloggers.map((datalogger) => (
              <DataloggerCard
                key={datalogger.id}
                datalogger={datalogger}
                onConnect={handleConnect}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contextual Status Bar */}
      <ContextualStatusBar
        leftItems={createCountItems(
          dataloggers.length,
          dataloggers.filter(d => d.status === 'active').length,
          dataloggers.filter(d => d.status !== 'active').length
        )}
        rightItems={createFilterItems(filteredDataloggers.length, searchTerm)}
      />
    </div>
  );
}