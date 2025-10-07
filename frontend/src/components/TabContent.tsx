"use client"
import React from 'react'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'
import { usePathname } from 'next/navigation'
import { GridLayout } from '@/components/GridLayout'

interface TabContentProps {
  children: React.ReactNode
}

export function TabContent({ children }: TabContentProps) {
  const { isTabModeEnabled, tabs, activeTabId, setActiveTab } = useTabStore()
  const { isGridModeEnabled } = useGridStore()
  const pathname = usePathname()

  // Se modalità griglia attiva (con o senza schede)
  if (isGridModeEnabled && !isTabModeEnabled) {
    return (
      <div className="flex-1 flex flex-col">
        <GridLayout />
      </div>
    )
  }

  // Se non siamo in modalità schede, mostra sempre il contenuto
  if (!isTabModeEnabled) {
    return <div className="flex-1 overflow-auto">{children}</div>
  }

  // Se siamo in modalità schede ma non ci sono schede
  if (tabs.length === 0) {
    // Se grid mode è attivo, auto-seleziona grid-tab
    if (isGridModeEnabled) {
      // Auto-attiva grid-tab se non è già attiva
      if (activeTabId !== 'grid-tab') {
        setActiveTab('grid-tab')
      }
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
    // Se grid mode è attivo e non è selezionata grid-tab, selezionala
    if (isGridModeEnabled && activeTabId !== 'grid-tab') {
      setActiveTab('grid-tab')
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

  // Se la scheda attiva corrisponde al percorso corrente, mostra il contenuto
  if (pathname === activeTab.url) {
    return <div className="flex-1 overflow-auto">{children}</div>
  }

  // Altrimenti mostra un placeholder
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-medium">{activeTab.customTitle || activeTab.title}</p>
        <p className="text-sm">Caricamento contenuto...</p>
      </div>
    </div>
  )
}