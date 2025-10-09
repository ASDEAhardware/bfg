"use client";
import React, { useState } from "react";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SchedulerModal } from "@/components/SchedulerModal";
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
  Circle
} from "lucide-react";

interface DataLogger {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
}

export default function DataLoggerPage() {
  const [selectedLogger, setSelectedLogger] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  // Stati per conferme azioni critiche
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  // Hook per rilevare la larghezza del container
  const [containerRef, { isMobile, isTablet, isDesktop, isXLarge }] = useContainerWidth();

  const availableLoggers: DataLogger[] = [
    { id: "logger-001", name: "Acquisitore Principale", type: "MQTT", status: "online" },
    { id: "logger-002", name: "Sensori Temperatura", type: "ModBus", status: "online" },
    { id: "logger-003", name: "Stazione Meteo", type: "TCP/IP", status: "offline" },
    { id: "logger-004", name: "Contatori Energia", type: "MQTT", status: "online" },
  ];

  const selectedLoggerData = availableLoggers.find(logger => logger.id === selectedLogger);

  const handleConnect = () => {
    if (selectedLogger) {
      setIsConnected(true);
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = () => {
    setIsConnected(false);
    setIsLogging(false);
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

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Responsive App Bar */}
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
                    {selectedLoggerData?.name}
                  </h2>
                  <Badge variant="outline" className="flex-shrink-0 text-xs">
                    {selectedLoggerData?.type}
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
                  {selectedLoggerData?.name}
                </h2>
                <Badge variant="outline">
                  {selectedLoggerData?.type}
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
                Acquisitore Connesso: {selectedLoggerData?.name}
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
              Stai per avviare l'acquisizione dati dall'acquisitore "{selectedLoggerData?.name}".
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
              Stai per disconnettere l'acquisitore "{selectedLoggerData?.name}".
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