"use client";

import React from 'react';
import { MapPin, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useSectionSiteContext } from '@/contexts/SectionSiteContext';

interface SectionSiteSelectorProps {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showInheritanceInfo?: boolean;
  className?: string;
}

export function SectionSiteSelector({
  size = 'sm',
  variant = 'outline',
  showInheritanceInfo = true,
  className = ''
}: SectionSiteSelectorProps) {
  const {
    sites,
    selectedSite,
    setSelectedSiteId,
    isLoading,
    sectionId,
    tabId,
    isSectionIsolated,
    inheritedFromTab,
    inheritedFromGlobal
  } = useSectionSiteContext();

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
          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
          <span className="text-xs">Loading...</span>
        </div>
      );
    }

    if (sites.length === 0) {
      return (
        <div className="flex items-center">
          <MapPin className="mr-1 h-3 w-3" />
          <span className="text-xs">No sites</span>
        </div>
      );
    }

    return (
      <div className="flex items-center">
        <MapPin className="mr-1 h-3 w-3" />
        <div className="flex flex-col text-left">
          {selectedSite ? (
            <div className="font-medium text-xs truncate max-w-[100px]">
              {selectedSite.name}
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">Select...</div>
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

        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onSelect={() => setSelectedSiteId(site.id)}
            className="flex flex-col items-start p-2"
          >
            <div className="flex items-center justify-between w-full">
              <div className="font-medium text-xs">{site.name}</div>
              {selectedSite?.id === site.id && (
                <Badge
                  variant={isSectionIsolated ? "default" : "secondary"}
                  className="text-xs px-1 py-0"
                >
                  {isSectionIsolated ? "Selected" :
                   inheritedFromTab ? "Tab" :
                   inheritedFromGlobal ? "Global" : "Active"}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {site.customer_name} • {getSiteTypeLabel(site.site_type)}
            </div>
          </DropdownMenuItem>
        ))}

        {sectionId && !isSectionIsolated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setSelectedSiteId(null)}
              className="text-xs text-muted-foreground"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reset to {tabId ? 'tab' : 'global'} selection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}