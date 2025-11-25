"use client";
import React, { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  Cpu,
  RefreshCw,
  MoreHorizontal,
  Activity,
  Gauge,
  Clock,
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Loader2,
  AlertCircle,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDatalogger, useSensors } from "@/hooks/useMqtt";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// Helper per mappare il tipo di sensore all'icona
const getSensorIcon = (type: string) => {
  const lowerType = type?.toLowerCase() || '';
  if (lowerType.includes('temp')) return Thermometer;
  if (lowerType.includes('hum')) return Droplets;
  if (lowerType.includes('wind')) return Wind;
  if (lowerType.includes('curr') || lowerType.includes('volt') || lowerType.includes('pow')) return Zap;
  if (lowerType.includes('press')) return Gauge;
  return Activity;
};

// Helper per formattare il valore con unità
const formatValue = (value: any, unit: string | undefined) => {
  if (value === undefined || value === null) return '-';
  const numValue = typeof value === 'number' ? value.toFixed(2) : value;
  return `${numValue}${unit ? ` ${unit}` : ''}`;
};

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.id as string;
  const { selectedSiteId } = useUnifiedSiteContext();

  // Fetch Datalogger Detail
  const { 
    datalogger, 
    loading: deviceLoading, 
    error: deviceError,
    refresh: refreshDevice 
  } = useDatalogger(deviceId);

  // 3. Fetch Sensors for this Datalogger
  const { 
    sensors, 
    loading: sensorsLoading, 
    error: sensorsError,
    refresh: refreshSensors 
  } = useSensors(datalogger);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  const handleBack = () => {
    router.push('/devices');
  };

  // Filter sensors
  const filteredSensors = useMemo(() => {
    if (!sensors) return [];
    return sensors.filter(sensor => {
      const matchesSearch = sensor.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.sensor_type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesOnlineFilter = showOnlineOnly ? sensor.is_online : true;

      return matchesSearch && matchesOnlineFilter;
    });
  }, [sensors, searchTerm, showOnlineOnly]);

  // Loading State
  if (deviceLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Caricamento dispositivo...</p>
      </div>
    );
  }

  // Error State
  if (deviceError || !datalogger) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Errore Caricamento</h2>
        <p className="text-muted-foreground text-center mb-4">
          {deviceError?.message || "Impossibile trovare il dispositivo richiesto."}
        </p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alla lista
        </Button>
      </div>
    );
  }

  const lastCommText = datalogger.last_seen_at
    ? formatDistanceToNow(new Date(datalogger.last_seen_at), { addSuffix: true, locale: it })
    : "Mai";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            {/* Left section: Back + Icon + Title + Status */}
            <div className="flex items-center gap-3 overflow-hidden">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold truncate">{datalogger.label}</h1>
              <div className="flex items-center justify-center w-6 h-6 shrink-0">
                <div 
                  className={`w-2 h-2 rounded-full ${datalogger.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} 
                />
              </div>
              <Badge variant="secondary" className="text-xs shrink-0 hidden sm:flex">
                {sensors.length} sensori
              </Badge>
            </div>

            {/* Right section: Search, Settings */}
            <div className="flex items-center gap-2 shrink-0">
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
                      placeholder="Cerca sensori..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                title="Impostazioni"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Sensors Grid */}
      <div className="flex-1 overflow-auto p-4">
        {sensorsLoading && sensors.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSensors.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchTerm ? 'Nessun sensore trovato con questo filtro' : 'Nessun sensore associato a questo dispositivo'}
          </div>
        ) : (
          <div className="grid-responsive-sensors">
            {filteredSensors.map((sensor) => {
              const SensorIcon = getSensorIcon(sensor.sensor_type);
              
              // Estrai l'ultimo valore valido dai readings
              const lastReadingData = sensor.latest_readings && sensor.latest_readings.length > 0 
                ? sensor.latest_readings[0] 
                : null;
                
              // Cerca un valore numerico nel data object (temp, hum, value, etc)
              let currentValue: any = sensor.current_value;
              
              // Se current_value non c'è, cerchiamo nei dati raw
              if ((currentValue === undefined || currentValue === null) && lastReadingData) {
                 // Logica euristica per trovare il valore
                 const data = lastReadingData.data;
                 if (data.value !== undefined) currentValue = data.value;
                 else if (data.temperature !== undefined) currentValue = data.temperature;
                 else if (data.humidity !== undefined) currentValue = data.humidity;
                 else if (Object.values(data).length > 0 && typeof Object.values(data)[0] === 'number') {
                    currentValue = Object.values(data)[0];
                 }
              }

              const lastReadingTime = sensor.last_reading
                ? formatDistanceToNow(new Date(sensor.last_reading), { addSuffix: true, locale: it })
                : "Mai";

              return (
                <Card key={sensor.id} className="card-standard hover:border-primary/50 transition-colors">
                  <CardContent className="card-content-standard p-4">
                    {/* Sensor Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                          <SensorIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold truncate" title={sensor.label}>
                            {sensor.label}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate" title={sensor.sensor_type}>
                            {sensor.sensor_type}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={sensor.is_online ? 'default' : 'outline'}
                        className={`flex-shrink-0 text-xs ${
                          sensor.is_online
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
                        }`}
                      >
                        {sensor.is_online ? 'Online' : 'Offline'}
                      </Badge>
                    </div>

                    {/* Current Value */}
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-foreground truncate">
                        {formatValue(currentValue, sensor.unit_of_measure)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{lastReadingTime}</span>
                      </div>
                    </div>

                    {/* Chart Placeholder */}
                    <div className="h-24 bg-muted/30 rounded flex items-center justify-center relative overflow-hidden">
                      <Activity className="h-6 w-6 text-muted-foreground/50" />
                      {/* Qui andrà il grafico sparkline reale */}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Bar Style Sidebar */}
      <div className="h-6 bg-sidebar border-t border-sidebar-border flex items-center justify-between px-3 text-[10px] text-sidebar-foreground/50 font-mono tracking-wider select-none shrink-0 cursor-default">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors cursor-pointer" title="Device Type">
            <Cpu className="h-3 w-3 opacity-80" />
            <span className="uppercase">{datalogger.datalogger_type}</span>
          </div>
          <div className="hover:text-sidebar-foreground/80 transition-colors" title="Serial Number">
            <span>S/N: {datalogger.serial_number}</span>
          </div>
          {datalogger.device_id && (
            <div className="hover:text-sidebar-foreground/80 transition-colors">
              <span>ID: {datalogger.device_id}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {datalogger.ip_address && (
            <div className="hover:text-sidebar-foreground/80 transition-colors hidden sm:flex">
              <span>IP: {datalogger.ip_address}</span>
            </div>
          )}
          {datalogger.firmware_version && (
            <div className="hover:text-sidebar-foreground/80 transition-colors hidden sm:flex">
              <span>FW: {datalogger.firmware_version}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors">
            <Activity className="h-3 w-3 opacity-80" />
            <span>UPTIME: {datalogger.uptime_percentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors" title={`Last Seen: ${lastCommText}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${datalogger.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{datalogger.is_online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>
      
      {/* Settings Panel */}
      <>
        <div
          className={`fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300 ${
            isSettingsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSettingsOpen(false)}
        />
        <div
          className={`fixed top-0 right-0 h-full w-80 bg-background border-l border-border shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out ${
            isSettingsOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Settings</h3>
              <Button onClick={() => setIsSettingsOpen(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-4">
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
            </div>
          </div>
        </div>
      </>
    </div>
  );
}
