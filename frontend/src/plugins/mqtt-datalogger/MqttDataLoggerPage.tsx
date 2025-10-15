"use client";

import React, { useState, useEffect } from "react";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { MqttSensorCard, MqttSensorCardCompact } from "@/components/MqttSensorCard";
import { MqttConnectionStatus } from "@/components/MqttConnectionStatus";
import { ContextualStatusBar } from "@/components/ContextualStatusBar";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useGridStore } from "@/store/gridStore";
import { useMqttSensorData, useMqttConnectionStatus } from "@/hooks/useMqttStatus";
import {
  Radio,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  AlertCircle,
  Activity,
  Gauge,
  MoreHorizontal,
  Settings,
  Wifi,
  WifiOff
} from "lucide-react";

export default function MqttDataLoggerPage() {
  const { selectedSiteId } = useUnifiedSiteContext();
  const { isGridModeEnabled } = useGridStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Hook per rilevare la larghezza del container
  const [containerRef, { isMobile, width }] = useContainerWidth();

  // MQTT hooks
  const { sensorData, loading, error, lastUpdate, refetch } = useMqttSensorData(
    selectedSiteId,
    autoRefreshEnabled ? 5000 : 0
  );
  const { connection, stats, isConnected } = useMqttConnectionStatus(selectedSiteId);

  // Filter sensors based on search and online status
  const filteredSensors = sensorData.filter(sensor => {
    const matchesSearch = sensor.device_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOnlineFilter = showOnlineOnly ? sensor.is_online : true;
    return matchesSearch && matchesOnlineFilter;
  });

  // Reset search when site changes
  useEffect(() => {
    setSearchTerm("");
    setShowOnlineOnly(false);
    setIsSearchOpen(false);
  }, [selectedSiteId]);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-2">
        <div className="flex flex-col">
          {/* Header row: Title + Controls - responsive */}
          <div className={`flex items-center ${width < 500 ? 'flex-col gap-2' : 'justify-between'}`}>
            {/* Left section: Icon + Title */}
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">MQTT Datalogger</h1>
              {isConnected && (
                <Badge variant="default" className="text-xs flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  Connesso
                </Badge>
              )}
              {!isConnected && connection && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
            </div>

            {/* Right section: All controls - responsive layout */}
            <div className={`flex items-center gap-2 ${width < 500 ? 'w-full justify-center' : ''}`}>
              {/* Auto refresh toggle */}
              {width >= 400 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-refresh"
                    checked={autoRefreshEnabled}
                    onCheckedChange={setAutoRefreshEnabled}
                  />
                  <Label htmlFor="auto-refresh" className={`text-sm whitespace-nowrap ${isMobile ? 'sr-only' : ''}`}>
                    Auto refresh
                  </Label>
                </div>
              )}

              {/* Online only toggle */}
              {width >= 350 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="online-only"
                    checked={showOnlineOnly}
                    onCheckedChange={setShowOnlineOnly}
                  />
                  <Label htmlFor="online-only" className={`text-sm whitespace-nowrap ${isMobile ? 'sr-only' : ''}`}>
                    Solo online
                  </Label>
                </div>
              )}

              {/* View mode toggle */}
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

              {/* Search toggle */}
              <Button
                variant={isSearchOpen ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="h-8 w-8 p-0"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className={`h-8 ${width < 350 ? 'w-8 p-0' : 'px-3'}`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {width >= 350 && !isMobile && <span className="ml-2">Aggiorna</span>}
              </Button>

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
                      checked={autoRefreshEnabled}
                      onCheckedChange={setAutoRefreshEnabled}
                    >
                      Auto refresh
                    </DropdownMenuCheckboxItem>
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

          {/* Search row - expandable with animation */}
          <div className={`transition-all duration-200 ease-in-out overflow-hidden ${
            isSearchOpen ? 'max-h-12 opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca sensori MQTT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus={isSearchOpen}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 pb-8">
        {!selectedSiteId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Radio className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nessun sito selezionato
              </h3>
              <p className="text-sm text-muted-foreground">
                Seleziona un sito dal menu in alto per visualizzare i dati MQTT
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection Status Card */}
            <MqttConnectionStatus
              siteId={selectedSiteId}
              showControls={true}
              compact={width < 600}
            />

            {/* Sensors Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Sensori MQTT
                    {lastUpdate && (
                      <Badge variant="outline" className="text-xs">
                        Aggiornato {lastUpdate.toLocaleTimeString()}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isConnected
                      ? "Monitoraggio dati in tempo reale"
                      : "In attesa di connessione MQTT"
                    }
                    {autoRefreshEnabled && " • Aggiornamento automatico ogni 5s"}
                  </p>
                </div>
              </div>

              {/* Sensors Grid/List */}
              {loading && sensorData.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Caricamento sensori MQTT...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-2">
                      Riprova
                    </Button>
                  </div>
                </div>
              ) : filteredSensors.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Gauge className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {sensorData.length === 0
                        ? 'Nessun sensore MQTT rilevato'
                        : 'Nessun sensore corrisponde ai filtri'
                      }
                    </p>
                    {sensorData.length > 0 && searchTerm && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Prova a modificare il termine di ricerca
                      </p>
                    )}
                    {sensorData.length === 0 && isConnected && (
                      <p className="text-xs text-muted-foreground mt-1">
                        I sensori appariranno automaticamente quando invieranno dati
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className={
                  viewMode === 'grid'
                    ? (width < 600 ? 'grid-responsive-cards-container' : 'grid-responsive-cards')
                    : 'space-y-3'
                }>
                  {filteredSensors.map((sensor) => (
                    viewMode === 'grid' ? (
                      <MqttSensorCard
                        key={sensor.device_name}
                        sensor={sensor}
                        showDetails={!isMobile}
                      />
                    ) : (
                      <MqttSensorCardCompact
                        key={sensor.device_name}
                        sensor={sensor}
                      />
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contextual Status Bar - only when not in grid mode */}
      {!isGridModeEnabled && selectedSiteId && (
        <ContextualStatusBar
          leftItems={[
            { label: 'Sito', value: selectedSiteId },
            { label: 'Sensori', value: sensorData.length },
            { label: 'Online', value: sensorData.filter(s => s.is_online).length, color: 'success' },
            { label: 'Offline', value: sensorData.filter(s => !s.is_online).length, color: sensorData.filter(s => !s.is_online).length > 0 ? 'error' : 'default' }
          ]}
          rightItems={[
            ...(searchTerm ? [{ label: 'Filtrati', value: filteredSensors.length }] : []),
            { label: 'Auto-refresh', value: autoRefreshEnabled ? 'ON' : 'OFF', color: autoRefreshEnabled ? 'success' : 'default' },
            { label: 'MQTT', value: isConnected ? 'Connected' : 'Offline', color: isConnected ? 'success' : 'error' },
            ...(lastUpdate ? [{ label: 'Aggiornato', value: lastUpdate.toLocaleTimeString() }] : [])
          ]}
        />
      )}
    </div>
  );
}