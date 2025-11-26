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
import { DeviceCard } from "@/components/DeviceCard";
import { useTranslations } from "next-intl";

// Sensor types for grouped cards (temporary - will be calculated from real data)
const adaqSensorTypes = [
  { icon: Thermometer, count: 0, labelKey: "temperature" },
  { icon: Droplets, count: 0, labelKey: "humidity" },
  { icon: Zap, count: 0, labelKey: "current" }
];

const wsSensorTypes = [
  { icon: Thermometer, count: 0, labelKey: "temperature" },
  { icon: Droplets, count: 0, labelKey: "humidity" },
  { icon: Wind, count: 0, labelKey: "wind" },
  { icon: Gauge, count: 0, labelKey: "pressure" }
];

export default function DevicesListPage() {
  const router = useRouter();
  const { selectedSiteId } = useUnifiedSiteContext();
  const { data: userData } = useUserInfo();
  const t = useTranslations('devices_list');

  // MQTT hooks
  const { connection: mqttConnection, isHeartbeatTimeout, refresh: refreshMqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { startConnection, stopConnection, forceDiscovery, loading: isMqttControlLoading } = useMqttControl();
  const { dataloggers: rawDataloggers, loading: dataloggerLoading, error: dataloggerError, refresh: refreshDataloggers } = useDataloggers(selectedSiteId);

  // Type-safe dataloggers array
  const dataloggers = (rawDataloggers || []) as any[];

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    adaq: false,
    weatherStations: false
  });

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
      return { variant: "secondary" as const, text: t('mqtt_not_configured'), className: "bg-muted text-muted-foreground", icon: WifiOff };
    }

    switch (mqttConnection.status) {
      case 'connected':
        return { variant: "default" as const, text: t('mqtt_connected'), className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100", icon: Wifi };
      case 'connecting':
        return { variant: "secondary" as const, text: t('mqtt_connecting'), className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 animate-pulse", icon: RefreshCw };
      case 'disconnected':
        return { variant: "outline" as const, text: t('mqtt_disconnected'), className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100", icon: WifiOff };
      case 'disabled':
        return { variant: "outline" as const, text: t('mqtt_disconnecting'), className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 animate-pulse", icon: RefreshCw };
      case 'error':
        // Distinguish between real errors and heartbeat timeout
        if (isHeartbeatTimeout) {
          return { variant: "secondary" as const, text: t('mqtt_device_offline'), className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100", icon: WifiOff };
        } else {
          return { variant: "outline" as const, text: t('mqtt_error'), className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", icon: WifiOff };
        }
      default:
        return { variant: "secondary" as const, text: t('mqtt_unknown'), className: "bg-muted text-muted-foreground", icon: WifiOff };
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

  const handleDeviceClick = (datalogger: any) => {
    router.push(`/devices/${datalogger.id}`);
  };

  const handleConfigClick = (deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/sensor-configuration');
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

  // Reset everything when site changes
  React.useEffect(() => {
    setSearchTerm("");
    setShowOnlineOnly(false);
  }, [selectedSiteId]);

  // Check if we have any devices at all
  const hasAnyDevice = monstroDevice || adaqDevices.length > 0 || weatherStationDevices.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">{t('title')}</h1>
              
              {/* Dropdown admin per start/stop MQTT */}
              {hasAdminPermissions && (
                <DropdownMenu open={isAdminDropdownOpen} onOpenChange={setIsAdminDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 border-primary/50 hover:border-primary"
                      title={t('admin_controls_tooltip')}
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
                      <span>{t('start_mqtt')}</span>
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
                      <span>{t('stop_mqtt')}</span>
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
                      <span>{t('force_discovery')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t('status_label')} {mqttConnection?.status || 'unknown'}
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
                      placeholder={t('search_placeholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Toggle Raggruppa/Espandi Devices - Mostra solo se ci sono gruppi (con più di 1 elemento) */}
              {(adaqDevices.length > 1 || weatherStationDevices.length > 1) && (
                hasExpandedGroups ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={collapseAllGroups}
                    className="h-6 px-2"
                  >
                    <Square className="h-3 w-3 mr-1" />
                    <span className="text-xs">{t('group_devices')}</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAllGroups}
                    className="h-6 px-2"
                  >
                    <Layers className="h-3 w-3 mr-1" />
                    <span className="text-xs">{t('expand_devices')}</span>
                  </Button>
                )
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
        {!hasAnyDevice && !dataloggerLoading ? (
           <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
             <Server className="h-12 w-12 mb-4 opacity-20" />
             <h3 className="text-lg font-medium">{t('no_device_found_title')}</h3>
             <p className="text-sm opacity-70 mb-4">{t('no_device_found_description')}</p>
             {hasAdminPermissions && (
               <Button variant="outline" onClick={handleForceDiscovery} disabled={isMqttControlLoading}>
                 <RefreshCw className={`h-4 w-4 mr-2 ${isMqttControlLoading ? 'animate-spin' : ''}`} />
                 {t('force_discovery')}
               </Button>
             )}
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {/* MONSTR-O - Always single card */}
            {monstroDevice && (
              <DeviceCard
                datalogger={monstroDevice}
                onConnect={handleDeviceClick}
                onLabelUpdate={() => refreshDataloggers()}
                compact={false}
              />
            )}

            {/* ADAQ - Grouped or Expanded - SHOW ONLY IF HAS DEVICES */}
            {/* Se c'è un solo device, mostralo diretto senza raggruppare */}
            {adaqDevices.length === 1 && (
              <DeviceCard
                datalogger={adaqDevices[0]}
                onConnect={handleDeviceClick}
                onLabelUpdate={() => refreshDataloggers()}
                compact={false}
              />
            )}

            {/* Se ci sono più devices, raggruppa o espandi */}
            {adaqDevices.length > 1 && (
              !expandedGroups.adaq ? (
                // Grouped Card
                <Card 
                  className="card-standard hover:border-primary/50 transition-colors relative overflow-hidden cursor-pointer"
                  onClick={() => toggleGroup('adaq')}
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
                          {t('analog_monitoring')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                        {t('group_badge')}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">{t('devices_label')}</div>
                            <div className="text-sm font-semibold">{adaqStats.online}/{adaqStats.total}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">{t('channels_4')}</div>
                            <div className="text-sm font-semibold">{adaqStats.channels4}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">{t('channels_8')}</div>
                            <div className="text-sm font-semibold">{adaqStats.channels8}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                        <div className="text-xs text-muted-foreground mb-2">{t('sensor_type_label')}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {adaqSensorTypes.map((sensor, idx) => {
                            const SensorIcon = sensor.icon;
                            return (
                              <div key={idx} className="flex flex-col items-center">
                                <SensorIcon className="h-4 w-4 text-muted-foreground mb-1" />
                                <span className="text-xs font-semibold">{t(sensor.labelKey)}</span>
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
                      {t('expand_group')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                // Expanded Cards
                <>
                  {adaqDevices.map((datalogger) => (
                    <DeviceCard
                      key={datalogger.id}
                      datalogger={datalogger}
                      onConnect={handleDeviceClick}
                      onLabelUpdate={() => refreshDataloggers()}
                      compact={false}
                    />
                  ))}
                </>
              )
            )}

            {/* WEATHER STATIONS - Grouped or Expanded - SHOW ONLY IF HAS DEVICES */}
            {/* Se c'è un solo device, mostralo diretto senza raggruppare */}
            {weatherStationDevices.length === 1 && (
              <DeviceCard
                datalogger={weatherStationDevices[0]}
                onConnect={handleDeviceClick}
                onLabelUpdate={() => refreshDataloggers()}
                compact={false}
              />
            )}

            {/* Se ci sono più devices, raggruppa o espandi */}
            {weatherStationDevices.length > 1 && (
              !expandedGroups.weatherStations ? (
                // Grouped Card
                <Card 
                  className="card-standard hover:border-primary/50 transition-colors relative overflow-hidden cursor-pointer"
                  onClick={() => toggleGroup('weatherStations')}
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
                          <h3 className="text-sm font-semibold">{t('weather_station_title')}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('weather_monitoring')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                        {t('group_badge')}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                        <div className="text-xs text-muted-foreground mb-1">{t('devices_label')}</div>
                        <div className="text-lg font-semibold">{wsStats.online}/{wsStats.total}</div>
                      </div>
                      
                      <div className="bg-background/50 rounded p-2.5 border border-primary/20">
                        <div className="text-xs text-muted-foreground mb-2">{t('sensor_type_label')}</div>
                        <div className="grid grid-cols-4 gap-2">
                          {wsSensorTypes.map((sensor, idx) => {
                            const SensorIcon = sensor.icon;
                            return (
                              <div key={idx} className="flex flex-col items-center">
                                <SensorIcon className="h-4 w-4 text-muted-foreground mb-1" />
                                <span className="text-xs font-semibold">{t(sensor.labelKey)}</span>
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
                      {t('expand_group')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {weatherStationDevices.map((datalogger) => (
                    <DeviceCard
                      key={datalogger.id}
                      datalogger={datalogger}
                      onConnect={handleDeviceClick}
                      onLabelUpdate={() => refreshDataloggers()}
                      compact={false}
                    />
                  ))}
                </>
              )
            )}

          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-sidebar border-t border-sidebar-border flex items-center justify-between px-3 text-[10px] text-sidebar-foreground/50 font-mono tracking-wider select-none shrink-0 cursor-default">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors cursor-pointer" title={`${t('status_tooltip')} ${mqttConnection?.status || 'unknown'}`}>
            <Wifi className={`h-3 w-3 ${mqttConnection?.status === 'connected' ? 'opacity-100' : 'opacity-50'}`} />
            <span>{t('mqtt_label')} {mqttConnection?.status?.toUpperCase() || 'UNKNOWN'}</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors">
            <Cpu className="h-3 w-3 opacity-80" />
            <span>{t('devices_count_label')} {filteredDataloggers.length}</span>
          </div>
          {(adaqStats.online + wsStats.online) > 0 && (
             <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors">
               <Activity className="h-3 w-3 opacity-80" />
               <span>{t('active_count_label')} {adaqStats.online + wsStats.online}</span>
             </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-sidebar-foreground/80 transition-colors">
            <div className={`h-1.5 w-1.5 rounded-full ${mqttConnection?.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{t('live_status')}</span>
          </div>
          <div className="hover:text-sidebar-foreground/80 transition-colors cursor-pointer" title={t('site_config_tooltip')}>
            <span>{selectedSiteId ? `${t('site_label')} ${selectedSiteId}` : t('no_site_label')}</span>
          </div>
          <div className="hover:text-sidebar-foreground/80 transition-colors">
            <span>{t('copyright')}</span>
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
              <h3 className="text-lg font-semibold text-foreground">{t('settings_panel_title')}</h3>
              <Button onClick={() => setIsSettingsOpen(false)} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {/* Auto Refresh Toggle - REMOVED since we use WebSockets now */}
              {/*
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
              */}

              {/* Solo Online Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="solo-online" className="text-sm font-medium text-foreground">
                  {t('online_only_label')}
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
            <AlertDialogTitle>{t('start_mqtt_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('start_mqtt_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMqttStart}>{t('start_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MQTT Stop Confirmation Dialog */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stop_mqtt_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stop_mqtt_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMqttStop}>{t('stop_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}