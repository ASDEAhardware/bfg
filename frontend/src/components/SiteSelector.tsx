"use client";

import React from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSiteContext } from '@/contexts/SiteContext';

export function SiteSelector() {
  const { sites, selectedSite, setSelectedSiteId, isLoading } = useSiteContext();

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

  if (isLoading) {
    return (
      <Button variant="outline" className="min-w-[200px] justify-start" disabled>
        <MapPin className="mr-2 h-4 w-4" />
        Loading sites...
      </Button>
    );
  }

  if (sites.length === 0) {
    return (
      <Button variant="outline" className="min-w-[200px] justify-start" disabled>
        <MapPin className="mr-2 h-4 w-4" />
        No sites available
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <div className="flex items-center">
            <MapPin className="mr-2 h-4 w-4" />
            <div className="text-left">
              {selectedSite ? (
                <div className="font-medium">{selectedSite.name}</div>
              ) : (
                "Select site..."
              )}
            </div>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[200px]">
        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onSelect={() => setSelectedSiteId(site.id)}
            className="flex flex-col items-start p-3"
          >
            <div className="font-medium">{site.name}</div>
            <div className="text-xs text-muted-foreground">
              {site.customer_name} • {getSiteTypeLabel(site.site_type)}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}