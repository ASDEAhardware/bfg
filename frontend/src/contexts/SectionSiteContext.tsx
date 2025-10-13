"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SiteListItem } from '@/types';
import { useTabSiteContext } from '@/contexts/TabSiteContext';

// Store per memorizzare il contesto dei siti per ogni sezione grid
interface SectionSiteStore {
  sectionSiteContexts: Record<string, {
    selectedSiteId: number | null;
    timestamp: number; // Per cleanup automatico
  }>;
  setSectionSiteId: (sectionId: string, siteId: number | null) => void;
  getSectionSiteId: (sectionId: string) => number | null;
  clearSectionSiteId: (sectionId: string) => void;
  clearOldSectionContexts: () => void;
}

export const useSectionSiteStore = create<SectionSiteStore>()(
  persist(
    (set, get) => ({
      sectionSiteContexts: {},

      setSectionSiteId: (sectionId: string, siteId: number | null) => {
        set((state) => ({
          sectionSiteContexts: {
            ...state.sectionSiteContexts,
            [sectionId]: {
              selectedSiteId: siteId,
              timestamp: Date.now()
            }
          }
        }));
      },

      getSectionSiteId: (sectionId: string) => {
        const state = get();
        return state.sectionSiteContexts[sectionId]?.selectedSiteId || null;
      },

      clearSectionSiteId: (sectionId: string) => {
        set((state) => {
          const newContexts = { ...state.sectionSiteContexts };
          delete newContexts[sectionId];
          return { sectionSiteContexts: newContexts };
        });
      },

      clearOldSectionContexts: () => {
        const state = get();
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 ore fa
        const newContexts: Record<string, { selectedSiteId: number | null; timestamp: number }> = {};

        Object.entries(state.sectionSiteContexts).forEach(([sectionId, context]) => {
          if (context.timestamp > cutoffTime) {
            newContexts[sectionId] = context;
          }
        });

        set({ sectionSiteContexts: newContexts });
      }
    }),
    {
      name: 'section-site-storage',
      partialize: (state) => ({
        sectionSiteContexts: state.sectionSiteContexts
      })
    }
  )
);

// Estende il TabSiteContextType per supportare sezioni
interface SectionSiteContextType {
  sites: SiteListItem[];
  selectedSite: SiteListItem | null;
  selectedSiteId: number | null;
  setSelectedSiteId: (siteId: number | null) => void;
  isLoading: boolean;
  error: Error | null;
  sectionId: string | null; // ID della sezione corrente
  tabId: string | null; // ID della tab (ereditato)
  isSectionIsolated: boolean; // True se questa sezione ha il proprio contesto
  inheritedFromTab: boolean; // True se sta usando il contesto tab
  inheritedFromGlobal: boolean; // True se sta usando il contesto globale
}

const SectionSiteContext = createContext<SectionSiteContextType | undefined>(undefined);

interface SectionSiteProviderProps {
  children: React.ReactNode;
  sectionId?: string | null; // Se null, usa il contesto tab/global
}

export function SectionSiteProvider({ children, sectionId = null }: SectionSiteProviderProps) {
  const tabSiteContext = useTabSiteContext();
  const {
    setSectionSiteId,
    getSectionSiteId,
    clearOldSectionContexts
  } = useSectionSiteStore();

  // Cleanup automatico dei contesti vecchi
  useEffect(() => {
    const interval = setInterval(clearOldSectionContexts, 60 * 60 * 1000); // Ogni ora
    return () => clearInterval(interval);
  }, [clearOldSectionContexts]);

  // Determina il selectedSiteId per questa sezione
  const sectionSelectedSiteId = sectionId ? getSectionSiteId(sectionId) : null;
  const effectiveSelectedSiteId = sectionSelectedSiteId ?? tabSiteContext.selectedSiteId;

  // Determina da dove viene ereditato
  const inheritedFromTab = sectionSelectedSiteId === null && tabSiteContext.tabId !== null && !tabSiteContext.inheritedFromGlobal;
  const inheritedFromGlobal = sectionSelectedSiteId === null && tabSiteContext.inheritedFromGlobal;

  // Trova il site attualmente selezionato
  const selectedSite = tabSiteContext.sites.find(site => site.id === effectiveSelectedSiteId) || null;

  // Funzione per settare il selectedSiteId per questa sezione
  const setSelectedSiteId = (siteId: number | null) => {
    if (sectionId) {
      setSectionSiteId(sectionId, siteId);
    } else {
      // Se non c'è sectionId, fallback al comportamento tab
      tabSiteContext.setSelectedSiteId(siteId);
    }
  };

  const value: SectionSiteContextType = {
    sites: tabSiteContext.sites,
    selectedSite,
    selectedSiteId: effectiveSelectedSiteId,
    setSelectedSiteId,
    isLoading: tabSiteContext.isLoading,
    error: tabSiteContext.error,
    sectionId,
    tabId: tabSiteContext.tabId,
    isSectionIsolated: sectionId !== null && sectionSelectedSiteId !== null,
    inheritedFromTab,
    inheritedFromGlobal
  };

  return (
    <SectionSiteContext.Provider value={value}>
      {children}
    </SectionSiteContext.Provider>
  );
}

// Hook che utilizza SectionSiteContext con fallback a TabSiteContext
export function useSectionSiteContext() {
  const sectionContext = useContext(SectionSiteContext);
  const tabContext = useTabSiteContext(); // Sempre chiamato per rispettare hook rules

  // Se non siamo dentro un SectionSiteProvider, usa il TabSiteContext
  if (sectionContext === undefined) {
    return {
      ...tabContext,
      sectionId: null,
      isSectionIsolated: false,
      inheritedFromTab: tabContext.tabId !== null && !tabContext.inheritedFromGlobal,
      inheritedFromGlobal: tabContext.inheritedFromGlobal
    } as SectionSiteContextType;
  }

  return sectionContext;
}

// Hook di utilità per verificare se siamo in un contesto sezione isolato
export function useIsSectionIsolated() {
  const context = useSectionSiteContext();
  return context.isSectionIsolated;
}