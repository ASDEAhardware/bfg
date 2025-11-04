"use client";

import { useSectionSiteContext } from '@/contexts/SectionSiteContext';

/**
 * Hook unificato per il site context.
 * Automaticamente utilizza il contesto più specifico disponibile:
 * SectionSiteContext -> TabSiteContext -> SiteContext globale
 *
 * Questo hook permette una migrazione graduale: i componenti possono iniziare
 * a usare questo hook invece di useSiteContext() direttamente, e otterranno
 * automaticamente il comportamento isolato per section/tab quando disponibile.
 */
export function useUnifiedSiteContext() {
  return useSectionSiteContext();
}

/**
 * Hook di utilità per verificare se il componente corrente
 * sta operando in un contesto isolato (tab o section)
 */
export function useIsInIsolatedMode() {
  const context = useSectionSiteContext();
  return context.sectionId !== null || context.tabId !== null;
}

/**
 * Hook di utilità per verificare se il componente corrente
 * sta operando in un contesto tab isolato
 */
export function useIsInTabMode() {
  const context = useSectionSiteContext();
  return context.tabId !== null;
}

/**
 * Hook di utilità per verificare se il componente corrente
 * sta operando in un contesto sezione isolato
 */
export function useIsInSectionMode() {
  const context = useSectionSiteContext();
  return context.sectionId !== null;
}

/**
 * Hook di utilità per ottenere informazioni diagnostiche
 * sul contesto corrente (utile per debug)
 */
export function useSiteContextDiagnostics() {
  const context = useSectionSiteContext();

  const getContextType = () => {
    if (context.sectionId) return 'section';
    if (context.tabId) return 'tab';
    return 'global';
  };

  const getInheritanceInfo = () => {
    if (context.isSectionIsolated) return 'section-isolated';
    if (context.inheritedFromTab) return 'inherited-from-tab';
    if (context.inheritedFromGlobal) return 'inherited-from-global';
    return 'direct';
  };

  return {
    sectionId: context.sectionId,
    tabId: context.tabId,
    isSectionIsolated: context.isSectionIsolated,
    isTabIsolated: context.tabId !== null && !context.inheritedFromGlobal,
    inheritedFromTab: context.inheritedFromTab,
    inheritedFromGlobal: context.inheritedFromGlobal,
    selectedSiteId: context.selectedSiteId,
    sitesCount: context.sites.length,
    contextType: getContextType(),
    inheritanceInfo: getInheritanceInfo()
  };
}