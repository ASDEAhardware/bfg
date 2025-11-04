"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SiteListItem } from '@/types';
import { useSiteContext } from '@/contexts/SiteContext';

// Store per memorizzare il contesto dei siti per ogni tab
interface TabSiteStore {
  tabSiteContexts: Record<string, {
    selectedSiteId: number | null;
    timestamp: number; // Per cleanup automatico
  }>;
  setTabSiteId: (tabId: string, siteId: number | null) => void;
  getTabSiteId: (tabId: string) => number | null;
  clearTabSiteId: (tabId: string) => void;
  clearOldTabContexts: () => void; // Cleanup per tab non più esistenti
}

export const useTabSiteStore = create<TabSiteStore>()(
  persist(
    (set, get) => ({
      tabSiteContexts: {},

      setTabSiteId: (tabId: string, siteId: number | null) => {
        set((state) => ({
          tabSiteContexts: {
            ...state.tabSiteContexts,
            [tabId]: {
              selectedSiteId: siteId,
              timestamp: Date.now()
            }
          }
        }));
      },

      getTabSiteId: (tabId: string) => {
        const state = get();
        return state.tabSiteContexts[tabId]?.selectedSiteId || null;
      },

      clearTabSiteId: (tabId: string) => {
        set((state) => {
          const newContexts = { ...state.tabSiteContexts };
          delete newContexts[tabId];
          return { tabSiteContexts: newContexts };
        });
      },

      clearOldTabContexts: () => {
        const state = get();
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 ore fa
        const newContexts: Record<string, { selectedSiteId: number | null; timestamp: number }> = {};

        Object.entries(state.tabSiteContexts).forEach(([tabId, context]) => {
          if (context.timestamp > cutoffTime) {
            newContexts[tabId] = context;
          }
        });

        set({ tabSiteContexts: newContexts });
      }
    }),
    {
      name: 'tab-site-storage',
      partialize: (state) => ({
        tabSiteContexts: state.tabSiteContexts
      })
    }
  )
);

// Estende il SiteContextType esistente con supporto per tab
interface TabSiteContextType {
  sites: SiteListItem[];
  selectedSite: SiteListItem | null;
  selectedSiteId: number | null;
  setSelectedSiteId: (siteId: number | null) => void;
  isLoading: boolean;
  error: Error | null;
  tabId: string | null; // ID della tab corrente
  isTabIsolated: boolean; // True se questa tab ha il proprio contesto
  inheritedFromGlobal: boolean; // True se sta usando il contesto globale
}

const TabSiteContext = createContext<TabSiteContextType | undefined>(undefined);

interface TabSiteProviderProps {
  children: React.ReactNode;
  tabId?: string | null; // Se null, usa il contesto globale
}

export function TabSiteProvider({ children, tabId = null }: TabSiteProviderProps) {
  const globalSiteContext = useSiteContext();
  const {
    setTabSiteId,
    getTabSiteId,
    clearOldTabContexts
  } = useTabSiteStore();

  // Cleanup automatico dei contesti vecchi
  useEffect(() => {
    const interval = setInterval(clearOldTabContexts, 60 * 60 * 1000); // Ogni ora
    return () => clearInterval(interval);
  }, [clearOldTabContexts]);

  // Determina il selectedSiteId per questa tab
  const tabSelectedSiteId = tabId ? getTabSiteId(tabId) : null;
  const effectiveSelectedSiteId = tabSelectedSiteId ?? globalSiteContext.selectedSiteId;
  const inheritedFromGlobal = tabSelectedSiteId === null;

  // Trova il site attualmente selezionato
  const selectedSite = globalSiteContext.sites.find(site => site.id === effectiveSelectedSiteId) || null;

  // Funzione per settare il selectedSiteId per questa tab
  const setSelectedSiteId = (siteId: number | null) => {
    if (tabId) {
      setTabSiteId(tabId, siteId);
    } else {
      // Se non c'è tabId, fallback al comportamento globale
      globalSiteContext.setSelectedSiteId(siteId);
    }
  };

  const value: TabSiteContextType = {
    sites: globalSiteContext.sites,
    selectedSite,
    selectedSiteId: effectiveSelectedSiteId,
    setSelectedSiteId,
    isLoading: globalSiteContext.isLoading,
    error: globalSiteContext.error,
    tabId,
    isTabIsolated: tabId !== null && tabSelectedSiteId !== null,
    inheritedFromGlobal
  };

  return (
    <TabSiteContext.Provider value={value}>
      {children}
    </TabSiteContext.Provider>
  );
}

// Hook che utilizza TabSiteContext con fallback a SiteContext
export function useTabSiteContext() {
  const tabContext = useContext(TabSiteContext);
  const globalContext = useSiteContext(); // Sempre chiamato, seguendo le rules of hooks

  // Se non siamo dentro un TabSiteProvider, usa il SiteContext globale
  if (tabContext === undefined) {
    return {
      ...globalContext,
      tabId: null,
      isTabIsolated: false,
      inheritedFromGlobal: true
    } as TabSiteContextType;
  }

  return tabContext;
}

// Hook di utilità per verificare se siamo in un contesto tab isolato
export function useIsTabIsolated() {
  const context = useTabSiteContext();
  return context.isTabIsolated;
}