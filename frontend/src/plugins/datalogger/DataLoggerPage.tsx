"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchedulerModal } from "@/components/SchedulerModal";
import { DataloggerCard } from "@/components/DataloggerCard";
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
  Building2
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

interface Site {
  id: string;
  name: string;
  customer_name: string;
  site_type: string;
}

export default function DataLoggerPage() {
  const pathname = usePathname();
  const { createCountItems, createFilterItems } = useContextualStatusBar();
  const { selectedSite, selectedSiteId } = useSiteContext();
  const [dataloggers, setDataloggers] = useState<Datalogger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
  const [containerRef, { isMobile, isTablet, isDesktop, isXLarge }] = useContainerWidth();

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

  const handleConnect = (datalogger: Datalogger) => {
    setSelectedLogger(datalogger);
    setIsConnected(true);
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
    setShowDisconnectConfirm(false);
  };

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

  const handleStatus = () => {
    console.log("Check status");
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
        <div className="bg-background border-b border-border">
          {/* Mobile Layout (< md) */}
          <div className={isMobile ? "block" : "hidden"}>
          {!isConnected ? (
            <div className="px-4 py-3 space-y-3">
              <Select value={selectedLogger} onValueChange={setSelectedLogger}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona acquisitore..." />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {availableLoggers.map((logger) => (
                    <SelectItem key={logger.id} value={logger.id} className="cursor-pointer">
                      <div className="flex items-center gap-2 w-full">
                        <Circle
                          className={`h-2 w-2 fill-current flex-shrink-0 ${
                            logger.status === 'online' ? 'text-status-success' : 'text-status-danger'
                          }`}
                        />
                        <span className="flex-1 truncate">{logger.name}</span>
                        <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs">
                          {logger.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleConnect}
                disabled={!selectedLogger}
                className="w-full cursor-pointer"
                size="sm"
              >
                Connetti
              </Button>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {/* Connected Device Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate">
                    {selectedLogger?.name}
                  </h2>
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {selectedLogger?.model}
                  </Badge>
                  {/* Status indicators */}
                  <div className="flex items-center gap-1 ml-2">
                    <Circle className="h-1.5 w-1.5 fill-current text-status-success animate-pulse" />
                    <span className="text-xs text-status-success">Connesso</span>
                    {isLogging && (
                      <>
                        <Circle className="h-1.5 w-1.5 fill-current text-status-info animate-pulse ml-1" />
                        <span className="text-xs text-status-info">Acquisizione</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="pl-2 ml-2 border-l border-border">
                  <button
                    onClick={handleDisconnect}
                    className="px-2 py-1.5 text-sm text-status-danger cursor-pointer"
                  >
                    Disconnetti
                  </button>
                </div>
              </div>

              {/* Control Buttons - All aligned to the right */}
              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleStart}
                  disabled={isLogging}
                  size="sm"
                  variant="default"
                  className="flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  <span className="text-xs">Start</span>
                </Button>

                <Button
                  onClick={handleStop}
                  disabled={!isLogging}
                  size="sm"
                  variant="destructive"
                  className="flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Square className="h-3 w-3" />
                  <span className="text-xs">Stop</span>
                </Button>

                <Button
                  onClick={handleSchedule}
                  size="sm"
                  variant="outline"
                  className="flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">Pianifica</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tablet/Desktop Layout (>= md) */}
        <div className={!isMobile ? "flex items-center justify-between px-6 py-4 min-h-[64px]" : "hidden"}>
          <div className="flex items-center gap-4">
            {!isConnected ? (
              <div className="flex items-center gap-3">
                <Select value={selectedLogger} onValueChange={setSelectedLogger}>
                  <SelectTrigger className="w-auto min-w-[280px] max-w-[400px]">
                    <SelectValue placeholder="Seleziona acquisitore..." />
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-[280px] max-w-[500px]">
                    {availableLoggers.map((logger) => (
                      <SelectItem key={logger.id} value={logger.id} className="cursor-pointer">
                        <div className="flex items-center gap-2 w-full">
                          <Circle
                            className={`h-2 w-2 fill-current flex-shrink-0 ${
                              logger.status === 'online' ? 'text-status-success' : 'text-status-danger'
                            }`}
                          />
                          <span className="flex-1 truncate">{logger.name}</span>
                          <Badge variant="outline" className="ml-2 flex-shrink-0">
                            {logger.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleConnect}
                  disabled={!selectedLogger}
                  size="sm"
                  className="cursor-pointer"
                >
                  Connetti
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {selectedLogger?.name}
                </h2>
                <Badge variant="outline">
                  {selectedLogger?.model}
                </Badge>
                {/* Status indicators */}
                <div className="flex items-center gap-1 ml-2">
                  <Circle className="h-1.5 w-1.5 fill-current text-green-500 animate-pulse" />
                  <span className="text-xs text-green-600">Connesso</span>
                  {isLogging && (
                    <>
                      <Circle className="h-1.5 w-1.5 fill-current text-blue-500 animate-pulse ml-1" />
                      <span className="text-xs text-blue-600">Acquisizione</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {isConnected && (
            <div className="flex items-center justify-end gap-2">
              {/* Control Buttons - All aligned to the right */}
              <Button
                onClick={handleStart}
                disabled={isLogging}
                size="sm"
                variant="default"
                className={`cursor-pointer ${isDesktop || isXLarge ? "flex items-center gap-1" : "block"}`}
              >
                <Play className="h-4 w-4" />
                {(isDesktop || isXLarge) && <span>Start</span>}
              </Button>

              <Button
                onClick={handleStop}
                disabled={!isLogging}
                size="sm"
                variant="destructive"
                className={`cursor-pointer ${isDesktop || isXLarge ? "flex items-center gap-1" : "block"}`}
              >
                <Square className="h-4 w-4" />
                {(isDesktop || isXLarge) && <span>Stop</span>}
              </Button>

              <Button
                onClick={handleSchedule}
                size="sm"
                variant="outline"
                className={`cursor-pointer ${isXLarge ? "flex items-center gap-1" : "block"}`}
              >
                <Calendar className="h-4 w-4" />
                {isXLarge && <span>Pianifica</span>}
              </Button>

              <div className="pl-2 ml-2 border-l border-border">
                <button
                  onClick={handleDisconnect}
                  className={`px-3 py-1.5 text-sm text-status-danger cursor-pointer ${
                    isDesktop || isXLarge ? "flex items-center gap-1" : "block"
                  }`}
                >
                  {(isDesktop || isXLarge) ? "Disconnetti" : "×"}
                </button>
              </div>
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
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">
                Acquisitore Connesso: {selectedLogger?.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isLogging
                  ? "Acquisizione dati in corso..."
                  : "Pronto per acquisire dati. Clicca Start per iniziare."
                }
              </p>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-muted-foreground">
                Qui verra visualizzato il contenuto dell acquisizione dati
              </p>
            </div>
          </div>
        )}
      </div>

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
      <div className="bg-background border-b border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Centrale di Controllo Datalogger</h1>
              <p className="text-sm text-muted-foreground">
                {selectedSite ? `Gestisci tutti i datalogger di ${selectedSite.name}` : 'Seleziona un sito per visualizzare i datalogger'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDataloggers}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca datalogger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="online-only"
                checked={showOnlineOnly}
                onCheckedChange={setShowOnlineOnly}
              />
              <Label htmlFor="online-only" className="text-sm">Solo online</Label>
            </div>

            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto p-4 pb-8">
        {!selectedSiteId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
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
              <Building2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
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