"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataloggerCard } from "@/components/DataloggerCard";
import { ContextualStatusBar, useContextualStatusBar } from "@/components/ContextualStatusBar";
import { useUnifiedSiteContext } from "@/hooks/useUnifiedSiteContext";
import { useGridStore } from "@/store/gridStore";
import { useUserInfo } from "@/hooks/useAuth";
import { useMqttConnectionStatus, useMqttControl, useDataloggers } from "@/hooks/useMqtt";
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
  RefreshCw,
  Search,
  Grid3X3,
  List,
  Videotape,
  MoreHorizontal,
  Info,
  X,
  Shield
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
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
  mqtt_api_version?: string;
  ip_address?: string;
  total_heartbeats: number;
  missed_heartbeats: number;
  uptime_percentage: number;
  sensors_count: number;
  active_sensors_count: number;
  created_at: string;
  updated_at: string;
}

export default function DataLoggerListPage() {
  const router = useRouter();
  const { createCountItems, createFilterItems } = useContextualStatusBar();
  const { selectedSiteId } = useUnifiedSiteContext();
  const { isGridModeEnabled } = useGridStore();
  const { data: userData } = useUserInfo();

  // MQTT hooks
  const { connection: mqttConnection, isHeartbeatTimeout, refresh: refreshMqttStatus } = useMqttConnectionStatus(selectedSiteId);
  const { startConnection, stopConnection, forceDiscovery, loading: isMqttControlLoading } = useMqttControl();
  const { dataloggers, loading: dataloggerLoading, error: dataloggerError, refresh: refreshDataloggers } = useDataloggers(selectedSiteId);


  // System info from dataloggers aggregated
  const systemInfo = dataloggers.length > 0 ? {
    total_dataloggers: dataloggers.length,
    online_dataloggers: dataloggers.filter(d => d.is_online).length,
    total_sensors: dataloggers.reduce((sum, d) => sum + d.sensors_count, 0),
    active_sensors: dataloggers.reduce((sum, d) => sum + d.active_sensors_count, 0),
    total_heartbeats: dataloggers.reduce((sum, d) => sum + d.total_heartbeats, 0),
    avg_uptime: dataloggers.reduce((sum, d) => sum + d.uptime_percentage, 0) / dataloggers.length,
    firmware_versions: [...new Set(dataloggers.map(d => d.firmware_version).filter(Boolean))],
    datalogger_types: [...new Set(dataloggers.map(d => d.datalogger_type).filter(Boolean))],
    api_versions: [...new Set(dataloggers.map(d => d.mqtt_api_version).filter(Boolean))],
    ip_addresses: dataloggers.map(d => d.ip_address).filter(Boolean),
    last_updated: Math.max(...dataloggers.map(d => new Date(d.updated_at).getTime()))
  } : null;

  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSystemInfoModal, setShowSystemInfoModal] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const skeletonTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // States for confirm dialogs
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Hook per rilevare la larghezza del container
  const [containerRef, { isMobile, width }] = useContainerWidth();


  // Helper function to get MQTT status badge variant and text
  const getMqttStatusBadge = () => {
    if (!selectedSiteId) return null;

    if (!mqttConnection) {
      return { variant: "secondary" as const, text: "MQTT not configured", className: "bg-muted text-muted-foreground" };
    }

    switch (mqttConnection.status) {
      case 'connected':
        return { variant: "default" as const, text: "MQTT connected", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" };
      case 'connecting':
        return { variant: "secondary" as const, text: "Connecting...", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 animate-pulse" };
      case 'disconnected':
        return { variant: "outline" as const, text: "MQTT disconnected", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" };
      case 'disabled':
        return { variant: "outline" as const, text: "Disconnecting...", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 animate-pulse" };
      case 'error':
        // Distinguish between real errors and heartbeat timeout
        if (isHeartbeatTimeout) {
          return { variant: "secondary" as const, text: "MQTT device offline", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" };
        } else {
          return { variant: "outline" as const, text: "MQTT error", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" };
        }
      default:
        return { variant: "secondary" as const, text: "MQTT unknown", className: "bg-muted text-muted-foreground" };
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

  const handleConnect = (datalogger: { id: string } & Omit<Datalogger, 'id'>) => { //type transformation: in questa riga diciamo al codice di trattare id come stringa e omettere il parametro "id" dell'interfaccia Datalogger (che originariamente è un numero) in quanto la prop che utilizza questa funzione si aspetta id come stringa.
    // Navigate to the detail page
    router.push(`/datalogger/${datalogger.id}`);
  };

  const handleDataloggerLabelUpdate = async (
    datalogger: { id: string } & Omit<Datalogger, 'id'>, //type transformation: in questa riga diciamo al codice di trattare id come stringa e omettere il parametro "id" dell'interfaccia Datalogger (che originariamente è un numero) in quanto la prop che utilizza questa funzione si aspetta id come stringa.
    newLabel: string
  ) => {
    try {
      await refreshDataloggers();
    } catch (error) {
      console.error('Failed to refresh dataloggers after label update:', error);
    }
  };

  // Skeleton delay effect - show skeleton only after 600ms of loading
  useEffect(() => {
    if (dataloggerLoading && !isAutoRefreshing) {
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
  }, [dataloggerLoading, isAutoRefreshing]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedSiteId) return;

    const interval = setInterval(async () => {
      setIsAutoRefreshing(true);
      try {
        await refreshDataloggers();
      } finally {
        setIsAutoRefreshing(false);
      }
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedSiteId, autoRefreshInterval, refreshDataloggers]);

  // Reset everything when site changes
  React.useEffect(() => {
    // Reset search terms and states when site changes
    setSearchTerm("");
    setShowOnlineOnly(false);
  }, [selectedSiteId]);

  // MQTT Control Functions (superuser only)
  const handleMqttStart = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    startConnection(selectedSiteId);
  };

  const handleMqttStop = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    stopConnection(selectedSiteId);
  };

  // Force Discovery Function
  const handleForceDiscovery = () => {
    if (!selectedSiteId || !userData?.is_superuser || isMqttControlLoading) return;
    forceDiscovery(selectedSiteId);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full relative">
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
                    {/* Admin Menu (superuser only) */}
                    {userData?.is_superuser && selectedSiteId && (
                      <DropdownMenu open={isAdminMenuOpen} onOpenChange={setIsAdminMenuOpen}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant={isAdminMenuOpen ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Admin Controls"
                            disabled={isMqttControlLoading || mqttConnection?.status === 'connecting' || mqttConnection?.status === 'disabled'}
                          >
                            {(isMqttControlLoading || mqttConnection?.status === 'connecting' || mqttConnection?.status === 'disabled') ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <div className="p-2 space-y-2">
                            {/* Start Button */}
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setIsAdminMenuOpen(false);
                                setShowStartConfirm(true);
                              }}
                              disabled={isMqttControlLoading || mqttConnection?.status === 'connected' || mqttConnection?.status === 'connecting'}
                              className="w-full justify-start gap-2"
                            >
                              {isMqttControlLoading && mqttConnection?.status === 'connecting' ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              <span>Start MQTT</span>
                            </Button>

                            {/* Stop Button */}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setIsAdminMenuOpen(false);
                                setShowStopConfirm(true);
                              }}
                              disabled={isMqttControlLoading || mqttConnection?.status !== 'connected'}
                              className="w-full justify-start gap-2"
                            >
                              {isMqttControlLoading && mqttConnection?.status === 'disabled' ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                              <span>Stop MQTT</span>
                            </Button>

                            {/* Force Discovery Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsAdminMenuOpen(false);
                                handleForceDiscovery();
                              }}
                              disabled={isMqttControlLoading || mqttConnection?.status !== 'connected'}
                              className="w-full justify-start gap-2"
                            >
                              {isMqttControlLoading ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              <span>Force Discovery</span>
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Right section: Search, View Toggle, More Menu */}
            <div className={`flex items-center gap-2 ${width < 500 ? 'w-full justify-center' : ''}`}>
              {/* Search Dropdown */}
              <DropdownMenu open={isSearchDropdownOpen} onOpenChange={setIsSearchDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isSearchDropdownOpen ? 'default' : 'outline'}
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
                      placeholder="Search dataloggers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

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
                    className="w-8 h-4 text-xs text-center px-1 border-0 bg-transparent text-foreground font-medium"
                    title="Auto-refresh interval in seconds"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshDataloggers}
                  disabled={dataloggerLoading || isMqttControlLoading}
                  className="h-6 px-2"
                  title="Refresh datalogger"
                >
                  {dataloggerLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  <span className="text-xs">Refresh</span>
                </Button>
              )}

              {/* System Info Button */}
              {systemInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSystemInfoModal(true)}
                  className="h-6 w-6 p-0"
                >
                  <Info className="h-4 w-4" />
                </Button>
              )}

              {/* Settings Button (3 dots) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="h-6 w-6 p-0"
                title="Settings"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {showSkeleton ? (
            // Loading skeleton - only shown after 600ms delay
            <div className="grid-responsive-cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted rounded-lg h-48"></div>
                </div>
              ))}
            </div>
          ) : dataloggerError ? (
            // Error state
            <div className="text-center py-8">
              <p className="text-destructive">Errore nel caricamento dei datalogger: {dataloggerError}</p>
            </div>
          ) : filteredDataloggers.length === 0 ? (
            // Empty state
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No dataloggers found for current search' : 'No dataloggers available'}
              </p>
            </div>
          ) : (
            // Datalogger grid
            <div className={viewMode === 'grid' ? 'grid-responsive-cards' : 'grid-responsive-list'}>
              {filteredDataloggers.map((datalogger) => (
                <DataloggerCard
                  key={datalogger.id}
                  datalogger={{
                    ...datalogger,
                    id: datalogger.id.toString()
                  }}
                  onConnect={handleConnect}
                  onLabelUpdate={handleDataloggerLabelUpdate}
                  compact={viewMode === 'list'}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Status Bar */}
      <ContextualStatusBar />

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

      {/* Contextual Status Bar - only when not in grid mode */}
      {!isGridModeEnabled && (
        <ContextualStatusBar
          leftItems={[
            // LEFT: Operational info (utili per l'operatore)
            ...createCountItems(
              dataloggers.length,
              dataloggers.filter(d => d.is_online).length,
              dataloggers.filter(d => !d.is_online).length
            ),
            ...createFilterItems(filteredDataloggers.length, searchTerm),
            ...(dataloggers.length > 0 ? [
              {
                label: 'Sensori',
                value: `${systemInfo?.active_sensors}/${systemInfo?.total_sensors}`,
                color: (systemInfo?.active_sensors || 0) >= (systemInfo?.total_sensors || 1) * 0.8 ? 'success' as const : 'warning' as const
              },
              {
                label: 'Heartbeats',
                value: (() => {
                  const total = systemInfo?.total_heartbeats || 0;
                  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`;
                  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
                  return total.toString();
                })(),
                color: 'default' as const
              },
              {
                label: 'Uptime Medio',
                value: `${(systemInfo?.avg_uptime || 0).toFixed(1)}%`,
                color: (systemInfo?.avg_uptime || 0) >= 90 ? 'success' as const : 'warning' as const
              }
            ] : [])
          ]}
          rightItems={[
            // RIGHT: System/Technical info (metadati e info tecniche)
            ...(systemInfo ? [
              {
                label: 'Firmware',
                value: systemInfo.firmware_versions.length > 0 ?
                  systemInfo.firmware_versions.length === 1 ?
                    systemInfo.firmware_versions[0]! :
                    `${systemInfo.firmware_versions.length} versioni` : 'N/A',
                color: 'default' as const
              },
              {
                label: 'Tipi DL',
                value: systemInfo.datalogger_types.length > 0 ? systemInfo.datalogger_types.join(', ') : 'N/A',
                color: 'default' as const
              },
              {
                label: 'API',
                value: systemInfo.api_versions.length > 0 ? systemInfo.api_versions.join(', ') : 'v1.0.0',
                color: 'default' as const
              },
              {
                label: 'Ultimo aggiornamento',
                value: systemInfo.last_updated ? new Date(systemInfo.last_updated).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'N/A',
                color: 'default' as const
              }
            ] : [])
          ]}
        />
      )}

      {/* System Info Modal */}
      <Dialog open={showSystemInfoModal} onOpenChange={setShowSystemInfoModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>System Information</DialogTitle>
            <DialogDescription>
              Informazioni dettagliate del sistema datalogger
            </DialogDescription>
          </DialogHeader>
          {systemInfo && (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Datalogger</div>
                  <div className="text-lg font-semibold">{systemInfo.online_dataloggers}/{systemInfo.total_dataloggers}</div>
                  <div className="text-xs text-muted-foreground">online</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Sensori</div>
                  <div className="text-lg font-semibold">{systemInfo.active_sensors}/{systemInfo.total_sensors}</div>
                  <div className="text-xs text-muted-foreground">attivi</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Heartbeats</div>
                  <div className="text-lg font-semibold">
                    {systemInfo.total_heartbeats >= 1000000 ?
                      `${(systemInfo.total_heartbeats / 1000000).toFixed(1)}M` :
                      systemInfo.total_heartbeats >= 1000 ?
                      `${(systemInfo.total_heartbeats / 1000).toFixed(0)}k` :
                      systemInfo.total_heartbeats}
                  </div>
                  <div className="text-xs text-muted-foreground">totali</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Uptime</div>
                  <div className="text-lg font-semibold">{systemInfo.avg_uptime.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">medio</div>
                </div>
              </div>

              {/* Firmware Versions */}
              {systemInfo.firmware_versions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Versioni Firmware</h3>
                  <div className="flex flex-wrap gap-1">
                    {systemInfo.firmware_versions.map((version, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {version}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Datalogger Types */}
              {systemInfo.datalogger_types.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Tipi Datalogger</h3>
                  <div className="flex flex-wrap gap-1">
                    {systemInfo.datalogger_types.map((type, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* API Versions */}
              {systemInfo.api_versions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Versioni API MQTT</h3>
                  <div className="flex flex-wrap gap-1">
                    {systemInfo.api_versions.map((version, idx) => (
                      <Badge key={idx} variant="default" className="text-xs">
                        {version}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* IP Addresses */}
              {systemInfo.ip_addresses.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Indirizzi IP Attivi ({systemInfo.ip_addresses.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs font-mono">
                    {systemInfo.ip_addresses.slice(0, 10).map((ip, idx) => (
                      <div key={idx} className="bg-muted/20 p-2 rounded text-xs">
                        {ip}
                      </div>
                    ))}
                    {systemInfo.ip_addresses.length > 10 && (
                      <div className="bg-muted/20 p-2 rounded text-xs text-muted-foreground">
                        ... e altri {systemInfo.ip_addresses.length - 10}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw Data (collapsed) */}
              <details className="bg-muted/20 p-3 rounded">
                <summary className="text-sm font-medium cursor-pointer">
                  Dati Raw (JSON)
                </summary>
                <pre className="text-xs bg-background p-3 rounded mt-2 overflow-auto max-h-40">
                  {JSON.stringify(systemInfo, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

              {/* View Mode Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Visualizzazione
                </Label>
                <div className="flex rounded-md border border-border overflow-hidden">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-6 w-6 p-0 rounded-none border-0"
                  >
                    <Grid3X3 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-6 w-6 p-0 rounded-none border-0 border-l border-border"
                  >
                    <List className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    </div>
  );
}