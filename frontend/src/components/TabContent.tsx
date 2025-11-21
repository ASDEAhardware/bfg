"use client"
import React, { useEffect } from 'react'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'
import { usePathname } from 'next/navigation'
import { GridLayout } from '@/components/GridLayout'
import { TabContentWithProvider } from '@/components/TabContentWithProvider'
import { TabContextHeader } from '@/components/TabContextHeader'
import { TabSiteProvider } from '@/contexts/TabSiteContext'

const IGNORED_PATHS = ['/version', '/settings'];

interface TabContentProps {
  children: React.ReactNode
}

export function TabContent({ children }: TabContentProps) {
  const { isTabModeEnabled, tabs, activeTabId, setActiveTab } = useTabStore()
  const { isGridModeEnabled } = useGridStore()
  const pathname = usePathname()

  // Effect per gestire l'attivazione automatica di grid-tab
  useEffect(() => {
    if (isGridModeEnabled && tabs.length === 0 && activeTabId !== 'grid-tab') {
      setActiveTab('grid-tab')
    }
  }, [isGridModeEnabled, tabs.length, activeTabId, setActiveTab])

  // Effect per gestire l'attivazione automatica quando non c'è una tab attiva
  useEffect(() => {
    const activeTab = tabs.find(tab => tab.id === activeTabId)
    if (!activeTab && isGridModeEnabled && activeTabId !== 'grid-tab') {
      setActiveTab('grid-tab')
    }
  }, [tabs, activeTabId, isGridModeEnabled, setActiveTab])

  // Se il percorso corrente deve essere ignorato dalla logica delle schede,
  // mostra semplicemente il contenuto della pagina (children).
  if (IGNORED_PATHS.includes(pathname) || pathname.startsWith('/devices')) {
    return <div className="flex-1 flex flex-col h-full overflow-hidden">{children}</div>;
  }

  // Se modalità griglia attiva (con o senza schede)
  if (isGridModeEnabled && !isTabModeEnabled) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <GridLayout />
      </div>
    )
  }

  // Se non siamo in modalità schede, mostra sempre il contenuto
  if (!isTabModeEnabled) {
    return <div className="flex-1 flex flex-col h-full overflow-hidden">{children}</div>
  }

  // Se siamo in modalità schede ma non ci sono schede
  if (tabs.length === 0) {
    // Se grid mode è attivo, mostra grid (l'attivazione è gestita da useEffect)
    if (isGridModeEnabled) {
      return (
        <div className="flex-1 flex flex-col">
          <GridLayout />
        </div>
      )
    }

    // Altrimenti mostra messaggio normale
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Modalità schede attiva</p>
          <p className="text-sm">Apri una pagina dal menu per iniziare</p>
        </div>
      </div>
    )
  }

  // Se è selezionata la scheda griglia e la griglia è attiva
  if (activeTabId === 'grid-tab' && isGridModeEnabled) {
    return (
      <div className="flex-1 flex flex-col">
        <GridLayout />
      </div>
    )
  }

  // Trova la scheda attiva
  const activeTab = tabs.find(tab => tab.id === activeTabId)

  // Se non c'è una scheda attiva
  if (!activeTab) {
    // Se grid mode è attivo, mostra grid (l'attivazione è gestita da useEffect)
    if (isGridModeEnabled) {
      return (
        <div className="flex-1 flex flex-col">
          <GridLayout />
        </div>
      )
    }

    // Altrimenti mostra messaggio
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Nessuna scheda selezionata</p>
          <p className="text-sm">Seleziona una scheda per vedere il contenuto</p>
        </div>
      </div>
    )
  }

  // Se la scheda attiva corrisponde al percorso corrente, mostra il contenuto con header
  if (pathname === activeTab.url) {
    return (
      <TabSiteProvider tabId={activeTab.id}>
        <div className="flex-1 flex flex-col">
          <TabContextHeader tab={activeTab} showDiagnostics={false} />
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </TabSiteProvider>
    )
  }

  // Altrimenti, renderizza la tab utilizzando TabContentWithProvider
  return (
    <div className="flex-1 overflow-auto">
      <TabContentWithProvider tab={activeTab} />
    </div>
  )
}