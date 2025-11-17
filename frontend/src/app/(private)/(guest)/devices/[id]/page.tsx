"use client";
import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Wind
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock device data
const mockDevice = {
  id: 1,
  label: "Datalogger Alpha",
  type: "Datalogger",
  serialNumber: "DL-001-2024",
  status: "online",
  uptime: 98.5,
  lastSeen: "2 minuti fa"
};

// Mock sensors data
const mockSensors = [
  {
    id: 1,
    label: "Temperatura Esterna",
    type: "Temperature",
    icon: Thermometer,
    value: "23.5°C",
    status: "online",
    lastReading: "30 secondi fa"
  },
  {
    id: 2,
    label: "Umidità",
    type: "Humidity",
    icon: Droplets,
    value: "65%",
    status: "online",
    lastReading: "30 secondi fa"
  },
  {
    id: 3,
    label: "Velocità Vento",
    type: "Wind Speed",
    icon: Wind,
    value: "12 km/h",
    status: "online",
    lastReading: "1 minuto fa"
  },
  {
    id: 4,
    label: "Temperatura Interna",
    type: "Temperature",
    icon: Thermometer,
    value: "21.2°C",
    status: "offline",
    lastReading: "2 ore fa"
  }
];

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Filter sensors
  const filteredSensors = mockSensors.filter(sensor =>
    sensor.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sensor.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBack = () => {
    router.push('/devices');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-1">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            {/* Left section: Back + Icon + Title + Status */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold">{mockDevice.label}</h1>
              <div className="flex items-center justify-center w-6 h-6">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredSensors.length} sensori
              </Badge>
            </div>

            {/* Right section: Search, Refresh, Settings */}
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
                      placeholder="Cerca sensori..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Refresh clicked')}
                className="h-6 px-2"
                title="Refresh sensori"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                <span className="text-xs">Refresh</span>
              </Button>

              {/* Settings Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Settings clicked')}
                className="h-6 w-6 p-0"
                title="Impostazioni"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Info Bar */}
      <div className="bg-muted/30 border-b border-border px-4 py-2">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">Tipo:</span>
            <span>{mockDevice.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">S/N:</span>
            <span className="font-mono">{mockDevice.serialNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>Uptime: {mockDevice.uptime}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Ultima comunicazione: {mockDevice.lastSeen}</span>
          </div>
        </div>
      </div>

      {/* Main Content - Sensors Grid */}
      <div className="flex-1 overflow-auto p-4">
        {filteredSensors.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchTerm ? 'Nessun sensore trovato' : 'Nessun sensore disponibile'}
          </div>
        ) : (
          <div className="grid-responsive-sensors">
            {filteredSensors.map((sensor) => {
              const SensorIcon = sensor.icon;
              return (
                <Card key={sensor.id} className="card-standard">
                  <CardContent className="card-content-standard p-4">
                    {/* Sensor Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                          <SensorIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold truncate">{sensor.label}</h3>
                          <p className="text-xs text-muted-foreground">{sensor.type}</p>
                        </div>
                      </div>
                      <Badge
                        variant={sensor.status === 'online' ? 'default' : 'outline'}
                        className={`flex-shrink-0 text-xs ${
                          sensor.status === 'online'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
                        }`}
                      >
                        {sensor.status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>

                    {/* Current Value */}
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-foreground">
                        {sensor.value}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{sensor.lastReading}</span>
                      </div>
                    </div>

                    {/* Chart Placeholder */}
                    <div className="h-24 bg-muted/30 rounded flex items-center justify-center">
                      <Activity className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
