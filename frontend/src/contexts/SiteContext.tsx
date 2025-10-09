"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { SiteListItem } from '@/types';
import { siteService } from '@/services/site.service';

interface SiteStore {
  selectedSiteId: number | null;
  setSelectedSiteId: (siteId: number | null) => void;
}

const useSiteStore = create<SiteStore>((set) => ({
  selectedSiteId: null,
  setSelectedSiteId: (siteId) => set({ selectedSiteId: siteId }),
}));

interface SiteContextType {
  sites: SiteListItem[];
  selectedSite: SiteListItem | null;
  selectedSiteId: number | null;
  setSelectedSiteId: (siteId: number | null) => void;
  isLoading: boolean;
  error: Error | null;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { selectedSiteId, setSelectedSiteId } = useSiteStore();

  // Fetch user's accessible sites
  const {
    data: sites = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['user-sites'],
    queryFn: siteService.getUserSites,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the currently selected site
  const selectedSite = sites.find(site => site.id === selectedSiteId) || null;

  // Auto-select first site if none selected and sites are available
  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [selectedSiteId, sites, setSelectedSiteId]);

  const value: SiteContextType = {
    sites,
    selectedSite,
    selectedSiteId,
    setSelectedSiteId,
    isLoading,
    error: error as Error | null,
  };

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext() {
  const context = useContext(SiteContext);
  if (context === undefined) {
    throw new Error('useSiteContext must be used within a SiteProvider');
  }
  return context;
}