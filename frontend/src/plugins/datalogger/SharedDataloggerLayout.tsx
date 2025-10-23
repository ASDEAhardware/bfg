"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, X } from "lucide-react";

// Simple Settings Panel Component
function SettingsPanel({
  isOpen,
  onClose,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  chartOpacity,
  setChartOpacity
}: {
  isOpen: boolean;
  onClose: () => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  chartOpacity: number;
  setChartOpacity: (opacity: number) => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl z-[9999] transition-transform duration-300"
        style={{
          transform: 'translateX(0)',
          position: 'fixed'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Impostazioni</h3>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Auto-refresh */}
          <div>
            <h4 className="font-medium mb-2">Auto-refresh</h4>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              />
              <span>Abilitato</span>
            </label>
          </div>

          {/* Chart Opacity */}
          <div>
            <h4 className="font-medium mb-2">Opacità Grafici: {chartOpacity}%</h4>
            <input
              type="range"
              min="0"
              max="50"
              value={chartOpacity}
              onChange={(e) => setChartOpacity(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </>
  );
}

interface SharedDataloggerLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export function SharedDataloggerLayout({ children, title, actions }: SharedDataloggerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Settings panel state - from URL params
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persistent settings - from localStorage
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [chartOpacity, setChartOpacity] = useState(20);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedAutoRefresh = localStorage.getItem('datalogger-auto-refresh');
    const savedChartOpacity = localStorage.getItem('datalogger-chart-opacity');

    if (savedAutoRefresh) {
      setAutoRefreshEnabled(savedAutoRefresh === 'true');
    }
    if (savedChartOpacity) {
      setChartOpacity(parseInt(savedChartOpacity));
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('datalogger-auto-refresh', autoRefreshEnabled.toString());
  }, [autoRefreshEnabled]);

  useEffect(() => {
    localStorage.setItem('datalogger-chart-opacity', chartOpacity.toString());
  }, [chartOpacity]);

  // Check URL params for settings panel state
  useEffect(() => {
    const settingsParam = searchParams.get('settings');
    setIsSettingsOpen(settingsParam === 'true');
  }, [searchParams]);

  const toggleSettings = () => {
    const newState = !isSettingsOpen;
    const params = new URLSearchParams(searchParams);

    if (newState) {
      params.set('settings', 'true');
    } else {
      params.delete('settings');
    }

    const newUrl = pathname + (params.toString() ? '?' + params.toString() : '');
    router.replace(newUrl);
  };

  const closeSettings = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('settings');
    const newUrl = pathname + (params.toString() ? '?' + params.toString() : '');
    router.replace(newUrl);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>

          <div className="flex items-center gap-2">
            {actions}

            {/* Settings Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSettings}
              className={`h-8 w-8 p-0 ${isSettingsOpen ? 'bg-accent' : ''}`}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        autoRefreshEnabled={autoRefreshEnabled}
        setAutoRefreshEnabled={setAutoRefreshEnabled}
        chartOpacity={chartOpacity}
        setChartOpacity={setChartOpacity}
      />
    </div>
  );
}

// Hook per accedere alle impostazioni nei componenti figli
export function useDataloggerSettings() {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [chartOpacity, setChartOpacity] = useState(20);

  useEffect(() => {
    const savedAutoRefresh = localStorage.getItem('datalogger-auto-refresh');
    const savedChartOpacity = localStorage.getItem('datalogger-chart-opacity');

    if (savedAutoRefresh) {
      setAutoRefreshEnabled(savedAutoRefresh === 'true');
    }
    if (savedChartOpacity) {
      setChartOpacity(parseInt(savedChartOpacity));
    }
  }, []);

  return {
    autoRefreshEnabled,
    chartOpacity
  };
}