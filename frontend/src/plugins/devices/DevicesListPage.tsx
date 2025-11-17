"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Cpu,
  Search,
  RefreshCw,
  MoreHorizontal,
  HardDrive,
  Activity,
  Gauge,
  Clock,
  ChevronDown,
  Layers,
  Settings,
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Grid3X3,
  Server,
  CloudRain,
  X,
  Pencil,
  Square,
  Shield,
  Play,
  Square as StopIcon,
  Wifi,
  WifiOff
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useMqttConnectionStatus, useMqttControl, useDataloggers } from "@/hooks/useMqtt";
import { useUserInfo } from "@/hooks/useAuth";
import { toast } from "sonner";

// Mock data per sviluppo UI
const mockDevices = {
  monstro: {
    id: "monstro-1",
    label: "Monstr-o Master",
    type: "monstr-o",
    serialNumber: "MO-001-2024",
    status: "online",
    sensors: 12,
    activeSensors: 11,
    uptime: 99.8,
    lastSeen: "30 secondi fa"
  },
  adaq: [
    {
      id: "adaq-1",
      label: "ADAQ 4CH - Zona A",
      type: "adaq",
      channels: 4,
      serialNumber: "AQ4-001-2024",
      status: "online",
      sensors: 4,
      activeSensors: 4,
      uptime: 98.5,
      lastSeen: "1 minuto fa"
    },
    {
      id: "adaq-2",
      label: "ADAQ 8CH - Zona B",
      type: "adaq",
      channels: 8,
      serialNumber: "AQ8-002-2024",
      status: "online",
      sensors: 8,
      activeSensors: 7,
      uptime: 97.2,
      lastSeen: "2 minuti fa"
    },
    {
      id: "adaq-3",
      label: "ADAQ 4CH - Zona C",
      type: "adaq",
      channels: 4,
      serialNumber: "AQ4-003-2024",
      status: "offline",
      sensors: 4,
      activeSensors: 0,
      uptime: 45.0,
      lastSeen: "3 ore fa"
    }
  ],
  weatherStations: [
    {
      id: "ws-1",
      label: "Stazione Meteo Nord",
      type: "weather-station",
      serialNumber: "WS-001-2024",
      status: "online",
      sensors: 6,
      activeSensors: 6,
      uptime: 99.5,
      lastSeen: "45 secondi fa"
    },
    {
      id: "ws-2",
      label: "Stazione Meteo Sud",
      type: "weather-station",
      serialNumber: "WS-002-2024",
      status: "online",
      sensors: 6,
      activeSensors: 5,
      uptime: 96.8,
      lastSeen: "1 minuto fa"
    }
  ]
};

// Mock sensor types for groups
const adaqSensorTypes = [
  { icon: Thermometer, count: 6, label: "Temperatura" },
  { icon: Droplets, count: 4, label: "Umidità" },
  { icon: Zap, count: 6, label: "Corrente" }
];

const wsSensorTypes = [
  { icon: Thermometer, count: 2, label: "Temperatura" },
  { icon: Droplets, count: 2, label: "Umidità" },
  { icon: Wind, count: 2, label: "Vento" },
  { icon: Gauge, count: 6, label: "Pressione" }
];

export default function DevicesListPage() {
  const router = useRouter();
  const { selectedSiteId } = useUnifiedSiteContext();
  const { data: userData } = useUserInfo();

  // MQTT hooks
  const { connection: mqttConnection, isHeartbeatTimeout, refresh: refreshMqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { startConnection, stopConnection, forceDiscovery, loading: isMqttControlLoading } = useMqttControl();
  const { dataloggers: rawDataloggers, loading: dataloggerLoading, error: dataloggerError, refresh: refreshDataloggers } = useDataloggers(selectedSiteId);

  // Type-safe dataloggers array
  const dataloggers = (rawDataloggers || []) as any[];

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    adaq: false,
    weatherStations: false
  });
  const [locationNames, setLocationNames] = useState<Record<string, string>>({
    'monstro-1': '',
    'adaq-1': 'Zona A',
    'adaq-2': 'Zona B', 
    'adaq-3': 'Zona C',
    'ws-1': 'Nord',
    'ws-2': 'Sud',
    'adaq-group': 'Produzione',
    'ws-group': 'Esterno'
  });
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  // TEMPORARY TEST - TO BE REMOVED
  const [showTestCards, setShowTestCards] = useState(false);

  // MQTT Control Functions (superuser only)
  const handleMqttStart = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    setIsAdminDropdownOpen(false);
    startConnection(selectedSiteId);
  };

  const handleMqttStop = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    setIsAdminDropdownOpen(false);
    stopConnection(selectedSiteId);
  };

  // Force Discovery Function
  const handleForceDiscovery = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    setIsAdminDropdownOpen(false);
    forceDiscovery(selectedSiteId);
  };

  const hasAdminPermissions = userData?.is_staff || userData?.is_superuser;

  // Helper function to get MQTT status badge variant and text
  const getMqttStatusBadge = () => {
    if (!selectedSiteId) return null;

    if (!mqttConnection) {
      return { variant: "secondary" as const, text: "MQTT not configured", className: "bg-muted text-muted-foreground", icon: WifiOff };
    }

    switch (mqttConnection.status) {
      case 'connected':
        return { variant: "default" as const, text: "MQTT connected", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100", icon: Wifi };
      case 'connecting':
        return { variant: "secondary" as const, text: "Connecting...", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 animate-pulse", icon: RefreshCw };
      case 'disconnected':
        return { variant: "outline" as const, text: "MQTT disconnected", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100", icon: WifiOff };
      case 'disabled':
        return { variant: "outline" as const, text: "Disconnecting...", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 animate-pulse", icon: RefreshCw };
      case 'error':
        // Distinguish between real errors and heartbeat timeout
        if (isHeartbeatTimeout) {
          return { variant: "secondary" as const, text: "MQTT device offline", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100", icon: WifiOff };
        } else {
          return { variant: "outline" as const, text: "MQTT error", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", icon: WifiOff };
        }
      default:
        return { variant: "secondary" as const, text: "MQTT unknown", className: "bg-muted text-muted-foreground", icon: WifiOff };
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const collapseAllGroups = () => {
    setExpandedGroups({
      adaq: false,
      weatherStations: false
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups({
      adaq: true,
      weatherStations: true
    });
  };

  const handleAutoRefreshChange = (enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    setIsSettingsOpen(false);
  };

  const handleDeviceClick = (deviceId: string) => {
    router.push(`/devices/${deviceId}`);
  };

  const handleConfigClick = (deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/sensor-configuration');
  };

  const handleLocationClick = (deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLocation(deviceId);
  };

  // Filter dataloggers based on search and online status
  const filteredDataloggers = dataloggers.filter((datalogger: any) => {
    const matchesSearch = datalogger.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.datalogger_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         datalogger.serial_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOnlineFilter = showOnlineOnly ? datalogger.is_online : true;

    return matchesSearch && matchesOnlineFilter;
  });

  // Group real dataloggers by type
  const monstroDevice = filteredDataloggers.find((d: any) => d.datalogger_type.toLowerCase().includes('monstr'));
  const adaqDevices = filteredDataloggers.filter((d: any) => d.datalogger_type.toLowerCase().includes('adaq'));
  const weatherStationDevices = filteredDataloggers.filter((d: any) =>
    d.datalogger_type.toLowerCase().includes('weather') ||
    d.datalogger_type.toLowerCase().includes('meteo')
  );

  // Check if any group is expanded
  const hasExpandedGroups = Object.values(expandedGroups).some((v: boolean) => v);

  // Calculate aggregated stats for groups
  const adaqStats = {
    total: adaqDevices.length,
    online: adaqDevices.filter((d: any) => d.is_online).length,
    totalSensors: adaqDevices.reduce((sum: number, d: any) => sum + d.sensors_count, 0),
    activeSensors: adaqDevices.reduce((sum: number, d: any) => sum + d.active_sensors_count, 0),
    channels4: 0, // TODO: needs channel info from backend
    channels8: 0, // TODO: needs channel info from backend
  };

  const wsStats = {
    total: weatherStationDevices.length,
    online: weatherStationDevices.filter((d: any) => d.is_online).length,
    totalSensors: weatherStationDevices.reduce((sum: number, d: any) => sum + d.sensors_count, 0),
    activeSensors: weatherStationDevices.reduce((sum: number, d: any) => sum + d.active_sensors_count, 0),
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedSiteId) return;

    const interval = setInterval(async () => {
      await refreshDataloggers();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedSiteId, autoRefreshInterval, refreshDataloggers]);

  // Reset everything when site changes
  React.useEffect(() => {
    setSearchTerm("");
    setShowOnlineOnly(false);
  }, [selectedSiteId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">Devices</h1>
              
              {/* Dropdown admin per start/stop MQTT */}
              {hasAdminPermissions && (
                <DropdownMenu open={isAdminDropdownOpen} onOpenChange={setIsAdminDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 border-primary/50 hover:border-primary"
                      title="Controlli Admin MQTT"
                    >
                      <Shield className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        setIsAdminDropdownOpen(false);
                        setShowStartConfirm(true);
                      }}
                      disabled={isMqttControlLoading || mqttConnection?.status === 'connected' || mqttConnection?.status === 'connecting'}
                      className="flex items-center gap-2"
                    >
                      {isMqttControlLoading && mqttConnection?.status === 'connecting' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span>Avvia MQTT</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setIsAdminDropdownOpen(false);
                        setShowStopConfirm(true);
                      }}
                      disabled={isMqttControlLoading || mqttConnection?.status !== 'connected'}
                      className="flex items-center gap-2"
                    >
                      {isMqttControlLoading && mqttConnection?.status === 'disabled' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <StopIcon className="h-4 w-4" />
                      )}
                      <span>Ferma MQTT</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleForceDiscovery}
                      disabled={isMqttControlLoading || mqttConnection?.status !== 'connected'}
                      className="flex items-center gap-2"
                    >
                      {isMqttControlLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span>Force Discovery</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Stato: {mqttConnection?.status || 'unknown'}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Label stato MQTT */}
              {(() => {
                const status = getMqttStatusBadge();
                return status && (
                  <Badge variant={status.variant} className={`text-xs h-6 flex items-center gap-1 ${status.className}`}>
                    <status.icon className="h-3 w-3" />
                    {status.text}
                  </Badge>
                );
              })()}
            </div>

            <div className="flex items-center gap-2">
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
                      placeholder="Cerca dispositivi..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* TEMPORARY TEST BUTTON - TO BE REMOVED */}
              <Button
                variant={showTestCards ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowTestCards(!showTestCards)}
                className="h-6 px-2"
              >
                <span className="text-xs">TEST 28</span>
              </Button>

              {/* Toggle Raggruppa/Espandi Devices */}
              {hasExpandedGroups ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={collapseAllGroups}
                  className="h-6 px-2"
                >
                  <Square className="h-3 w-3 mr-1" />
                  <span className="text-xs">Raggruppa Devices</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandAllGroups}
                  className="h-6 px-2"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  <span className="text-xs">Espandi Devices</span>
                </Button>
              )}

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
                  onClick={() => refreshDataloggers()}
                  disabled={dataloggerLoading || isMqttControlLoading}
                  className="h-6 px-2"
                >
                  {dataloggerLoading ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  <span className="text-xs">Refresh</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Grid 4 per row */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          
          {/* MONSTR-O - Always single card */}
          {!showTestCards && <Card 
            className="card-standard cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => handleDeviceClick(mockDevices.monstro.id)}
          >
            <CardContent className="card-content-detailed flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1"
                    onMouseEnter={() => setHoveredDevice(mockDevices.monstro.id)}
                    onMouseLeave={() => setHoveredDevice(null)}
                  >
                    <Server className="h-4 w-4 text-primary" />
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-semibold">Monstr-o</h3>
                      {editingLocation === mockDevices.monstro.id ? (
                        <>
                          <span className="text-sm text-muted-foreground mx-1">-</span>
                          <Input
                            value={locationNames[mockDevices.monstro.id] || ''}
                            onChange={(e) => setLocationNames(prev => ({ ...prev, [mockDevices.monstro.id]: e.target.value }))}
                            onBlur={() => setEditingLocation(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingLocation(null);
                              }
                            }}
                            className="h-5 w-32 text-sm font-semibold px-1 py-0"
                            placeholder="Posizione"
                            autoFocus
                          />
                        </>
                      ) : locationNames[mockDevices.monstro.id] ? (
                        <>
                          <span className="text-sm text-muted-foreground mx-1">-</span>
                          <span className="text-sm font-semibold">{locationNames[mockDevices.monstro.id]}</span>
                          {hoveredDevice === mockDevices.monstro.id && (
                            <Pencil 
                              className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                              onClick={(e) => handleLocationClick(mockDevices.monstro.id, e)}
                            />
                          )}
                        </>
                      ) : hoveredDevice === mockDevices.monstro.id ? (
                        <Pencil 
                          className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                          onClick={(e) => handleLocationClick(mockDevices.monstro.id, e)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Master Controller</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="flex-shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Online
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleConfigClick(mockDevices.monstro.id, e)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Dispositivi</div>
                      <div className="text-sm font-semibold">28/30</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">NNN</div>
                      <div className="text-sm font-semibold">3</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">HNN</div>
                      <div className="text-sm font-semibold">2</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">HGN</div>
                      <div className="text-sm font-semibold">4</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-2">Tipologia Sensori</div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="flex flex-col items-center">
                      <Activity className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-semibold">3</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Gauge className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-semibold">2</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Thermometer className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-semibold">2</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Zap className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-semibold">1</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Wind className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-semibold">1</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-auto" size="sm">
                Visualizza
              </Button>
            </CardContent>
          </Card>}

          {/* ADAQ - Grouped or Expanded */}
          {!expandedGroups.adaq ? (
            // Grouped Card
            <Card 
              className="card-standard hover:border-primary/50 transition-colors relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--primary) / 0.02) 100%)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'hsl(var(--primary) / 0.3)'
              }}
            >
              <CardContent className="card-content-detailed flex flex-col h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-primary" />
                      <h3 className="text-sm font-semibold">ADAQ</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Monitoraggio analogico
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                    GRUPPO
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Dispositivi</div>
                        <div className="text-sm font-semibold">{adaqStats.online}/{adaqStats.total}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">4 Canali</div>
                        <div className="text-sm font-semibold">{adaqStats.channels4}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">8 Canali</div>
                        <div className="text-sm font-semibold">{adaqStats.channels8}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-2">Tipologia Sensori</div>
                    <div className="grid grid-cols-3 gap-2">
                      {adaqSensorTypes.map((sensor, idx) => {
                        const SensorIcon = sensor.icon;
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <SensorIcon className="h-4 w-4 text-muted-foreground mb-1" />
                            <span className="text-xs font-semibold">{sensor.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full mt-auto" 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup('adaq');
                  }}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Espandi Gruppo
                </Button>
              </CardContent>
            </Card>
          ) : (
            // Expanded Cards
            <>
              {mockDevices.adaq.map((device) => (
                <Card 
                  key={device.id}
                  className="card-standard cursor-pointer hover:border-primary/50 transition-colors relative"
                  onClick={() => handleDeviceClick(device.id)}
                >
                  <CardContent className="card-content-detailed flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1"
                          onMouseEnter={() => setHoveredDevice(device.id)}
                          onMouseLeave={() => setHoveredDevice(null)}
                        >
                          <Cpu className="h-4 w-4 text-primary" />
                          <div className="flex items-center gap-1">
                            <h3 className="text-sm font-semibold">ADAQ</h3>
                            {editingLocation === device.id ? (
                              <>
                                <span className="text-sm text-muted-foreground mx-1">-</span>
                                <Input
                                  value={locationNames[device.id] || ''}
                                  onChange={(e) => setLocationNames(prev => ({ ...prev, [device.id]: e.target.value }))}
                                  onBlur={() => setEditingLocation(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingLocation(null);
                                    }
                                  }}
                                  className="h-5 w-32 text-sm font-semibold px-1 py-0"
                                  placeholder="Posizione"
                                  autoFocus
                                />
                              </>
                            ) : locationNames[device.id] ? (
                              <>
                                <span className="text-sm text-muted-foreground mx-1">-</span>
                                <span className="text-sm font-semibold">{locationNames[device.id]}</span>
                                {hoveredDevice === device.id && (
                                  <Pencil 
                                    className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                                    onClick={(e) => handleLocationClick(device.id, e)}
                                  />
                                )}
                              </>
                            ) : hoveredDevice === device.id ? (
                              <Pencil 
                                className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                                onClick={(e) => handleLocationClick(device.id, e)}
                              />
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{device.channels} Canali</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`flex-shrink-0 ${
                            device.status === 'online'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
                          }`}
                        >
                          {device.status === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleConfigClick(device.id, e)}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">S/N:</span>
                        <span className="font-mono text-xs">{device.serialNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Sensori:</span>
                        <span className="text-xs">{device.activeSensors}/{device.sensors} attivi</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Uptime:</span>
                        <span className="text-xs">{device.uptime}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Ultima comunicazione:</span>
                        <span className="text-xs">{device.lastSeen}</span>
                      </div>
                    </div>

                    <Button className="w-full mt-auto" size="sm">
                      Visualizza
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* WEATHER STATIONS - Grouped or Expanded */}
          {!expandedGroups.weatherStations ? (
            // Grouped Card
            <Card 
              className="card-standard hover:border-primary/50 transition-colors relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--primary) / 0.02) 100%)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'hsl(var(--primary) / 0.3)'
              }}
            >
              <CardContent className="card-content-detailed flex flex-col h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-5 w-5 text-primary" />
                      <h3 className="text-sm font-semibold">Stazione meteo</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Monitoraggio meteorologico
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                    GRUPPO
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">Dispositivi</div>
                    <div className="text-lg font-semibold">{wsStats.online}/{wsStats.total}</div>
                  </div>
                  
                  <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-2">Tipologia Sensori</div>
                    <div className="grid grid-cols-4 gap-2">
                      {wsSensorTypes.map((sensor, idx) => {
                        const SensorIcon = sensor.icon;
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <SensorIcon className="h-4 w-4 text-muted-foreground mb-1" />
                            <span className="text-xs font-semibold">{sensor.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full mt-auto" 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup('weatherStations');
                  }}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Espandi Gruppo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {mockDevices.weatherStations.map((device) => (
                <Card 
                  key={device.id}
                  className="card-standard cursor-pointer hover:border-primary/50 transition-colors relative"
                  onClick={() => handleDeviceClick(device.id)}
                >
                  <CardContent className="card-content-detailed flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1"
                          onMouseEnter={() => setHoveredDevice(device.id)}
                          onMouseLeave={() => setHoveredDevice(null)}
                        >
                          <CloudRain className="h-4 w-4 text-primary" />
                          <div className="flex items-center gap-1">
                            <h3 className="text-sm font-semibold">Stazione meteo</h3>
                            {editingLocation === device.id ? (
                              <>
                                <span className="text-sm text-muted-foreground mx-1">-</span>
                                <Input
                                  value={locationNames[device.id] || ''}
                                  onChange={(e) => setLocationNames(prev => ({ ...prev, [device.id]: e.target.value }))}
                                  onBlur={() => setEditingLocation(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingLocation(null);
                                    }
                                  }}
                                  className="h-5 w-32 text-sm font-semibold px-1 py-0"
                                  placeholder="Posizione"
                                  autoFocus
                                />
                              </>
                            ) : locationNames[device.id] ? (
                              <>
                                <span className="text-sm text-muted-foreground mx-1">-</span>
                                <span className="text-sm font-semibold">{locationNames[device.id]}</span>
                                {hoveredDevice === device.id && (
                                  <Pencil 
                                    className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                                    onClick={(e) => handleLocationClick(device.id, e)}
                                  />
                                )}
                              </>
                            ) : hoveredDevice === device.id ? (
                              <Pencil 
                                className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary transition-colors ml-1"
                                onClick={(e) => handleLocationClick(device.id, e)}
                              />
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Weather Station</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="flex-shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Online
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleConfigClick(device.id, e)}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">S/N:</span>
                        <span className="font-mono text-xs">{device.serialNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Sensori:</span>
                        <span className="text-xs">{device.activeSensors}/{device.sensors} attivi</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Uptime:</span>
                        <span className="text-xs">{device.uptime}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Ultima comunicazione:</span>
                        <span className="text-xs">{device.lastSeen}</span>
                      </div>
                    </div>

                    <Button className="w-full mt-auto" size="sm">
                      Visualizza
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* TEMPORARY TEST - 28 CARDS - TO BE REMOVED */}
          {showTestCards && Array.from({ length: 28 }).map((_, idx) => (
            <Card 
              key={`test-${idx}`}
              className="card-standard cursor-pointer hover:border-primary/50 transition-colors"
            >
              <CardContent className="card-content-detailed flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Banana - Test {idx + 1}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">4 Canali</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="flex-shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      Online
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">S/N:</span>
                    <span className="font-mono text-xs">AQ4-TEST-{idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sensori:</span>
                    <span className="text-xs">4/4 attivi</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Uptime:</span>
                    <span className="text-xs">98.5%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Ultima comunicazione:</span>
                    <span className="text-xs">1 minuto fa</span>
                  </div>
                </div>

                <Button className="w-full mt-auto" size="sm">
                  Visualizza
                </Button>
              </CardContent>
            </Card>
          ))}

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
              {/* Auto Refresh Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh" className="text-sm font-medium text-foreground">
                  Auto refresh
                </Label>
                <Switch
                  id="auto-refresh"
                  checked={autoRefreshEnabled}
                  onCheckedChange={handleAutoRefreshChange}
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
            </div>
          </div>
        </div>
      </>

      {/* MQTT Start Confirmation Dialog */}
      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start MQTT Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This will start the MQTT connection for site monitoring. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMqttStart}>Start</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MQTT Stop Confirmation Dialog */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop MQTT Connection</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the MQTT connection and monitoring. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMqttStop}>Stop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
