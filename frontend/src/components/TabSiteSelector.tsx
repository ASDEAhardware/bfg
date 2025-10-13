"use client";

import React from 'react';
import { MapPin, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTabSiteContext } from '@/contexts/TabSiteContext';
import { useSiteContextDiagnostics } from '@/hooks/useUnifiedSiteContext';

interface TabSiteSelectorProps {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showInheritanceInfo?: boolean;
  className?: string;
}

export function TabSiteSelector({
  size = 'sm',
  variant = 'outline',
  showInheritanceInfo = true,
  className = ''
}: TabSiteSelectorProps) {
  const { sites, selectedSite, setSelectedSiteId, isLoading, tabId, inheritedFromGlobal } = useTabSiteContext();

  const getSiteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bridge: 'Bridge',
      building: 'Building',
      tunnel: 'Tunnel',
      dam: 'Dam',
      tower: 'Tower',
      pipeline: 'Pipeline',
      other: 'Other'
    };
    return labels[type] || type;
  };

  // Determina il titolo e lo stile del bottone
  const getButtonContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      );
    }

    if (sites.length === 0) {
      return (
        <div className="flex items-center">
          <MapPin className="mr-2 h-4 w-4" />
          <span>No sites</span>
        </div>
      );
    }

    return (
      <div className="flex items-center">
        <MapPin className="mr-1 h-3 w-3" />
        <div className="flex flex-col text-left">
          {selectedSite ? (
            <div className="font-medium text-xs truncate max-w-[100px]">{selectedSite.name}</div>
          ) : (
            <div className="text-muted-foreground text-xs">Select site...</div>
          )}
        </div>
      </div>
    );
  };

  const isDisabled = isLoading || sites.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isDisabled}
          className={`justify-between min-w-[100px] h-7 ${className}`}
        >
          {getButtonContent()}
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[200px]" align="start">
        {tabId && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Tab Context: {tabId.slice(-8)}...
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {inheritedFromGlobal && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">Global</Badge>
              Currently using global site selection
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onSelect={() => setSelectedSiteId(site.id)}
            className="flex flex-col items-start p-3"
          >
            <div className="flex items-center justify-between w-full">
              <div className="font-medium">{site.name}</div>
              {selectedSite?.id === site.id && (
                <Badge variant={inheritedFromGlobal ? "secondary" : "default"} className="text-xs">
                  {inheritedFromGlobal ? "Global" : "Selected"}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {site.customer_name} • {getSiteTypeLabel(site.site_type)}
            </div>
          </DropdownMenuItem>
        ))}

        {showInheritanceInfo && tabId && !inheritedFromGlobal && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setSelectedSiteId(null)}
              className="text-xs text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Reset to global selection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}