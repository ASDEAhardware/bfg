"use client"
import React, { useState } from 'react'
import { Plus, X, GripHorizontal, GripVertical, Link2Off, Maximize2, LayoutDashboard, Shield, MonitorCog, SquareChartGantt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGridStore, GridSection as GridSectionType } from '@/store/gridStore'
import { useTabStore } from '@/store/tabStore'
import { cn } from '@/lib/utils'
import { TabContentRenderer } from '@/components/TabContentRenderer'
import { PageSelector } from '@/components/PageSelector'
import { useRouter } from 'next/navigation'

interface GridSectionProps {
  section: GridSectionType
  isActive: boolean
  canSplitHorizontal: boolean
  canSplitVertical: boolean
  canRemove: boolean
}

export function GridSection({
  section,
  isActive,
  canSplitHorizontal,
  canSplitVertical,
  canRemove
}: GridSectionProps) {
  const {
    splitSection,
    removeSection,
    assignTabToSection,
    assignVirtualPageToSection,
    clearSectionTab,
    setActiveSection,
    closeSection,
    getVirtualPage,
    isGridModeEnabled,
    toggleGridMode
  } = useGridStore()
  const { tabs, isTabModeEnabled, toggleTabMode, openTabInBackground, activeTabId, setActiveTab } = useTabStore()
  const router = useRouter()
  const [isDragOver, setIsDragOver] = useState(false)

  // Funzione per ottenere l'icona appropriata in base all'URL
  const getPageIcon = (url: string) => {
    switch (url) {
      case '/dashboard':
        return LayoutDashboard
      case '/staff-admin':
        return Shield
      case '/system':
        return MonitorCog
      default:
        return SquareChartGantt // Icona di default per pagine non mappate
    }
  }

  // Funzione per ottenere il titolo della scheda (sempre completo, mai compresso)
  const getDisplayTitle = (tab: any) => {
    if (!tab) return "Nessuna pagina assegnata"

    // Mostra sempre il titolo completo: customTitle se esiste, altrimenti title
    return tab.customTitle || tab.title
  }

  // Handle both real tabs and virtual grid tabs
  const assignedTab = section.tabId ?
    tabs.find(tab => tab.id === section.tabId) ||
    getVirtualPage(section.tabId) ||
    (section.tabId.startsWith('grid-page-') ? createVirtualTab(section.tabId) : null)
    : null

  // Create virtual tab for grid sections
  function createVirtualTab(tabId: string): any {
    const availablePageMap: { [key: string]: { url: string, title: string } } = {
      'grid-page-dashboard': { url: '/dashboard', title: 'Dashboard' },
      'grid-page-settings': { url: '/settings', title: 'Impostazioni' },
    }

    // Extract the page type from tabId
    const pageType = tabId.split('-').slice(0, 3).join('-')
    const pageInfo = availablePageMap[pageType]

    if (pageInfo) {
      return {
        id: tabId,
        title: pageInfo.title,
        url: pageInfo.url,
        isActive: false
      }
    }
    return null
  }

  const handleSectionClick = () => {
    setActiveSection(section.id)
  }

  const handleSplitHorizontal = () => {
    if (canSplitHorizontal) {
      splitSection(section.id, 'horizontal')
    }
  }

  const handleSplitVertical = () => {
    if (canSplitVertical) {
      splitSection(section.id, 'vertical')
    }
  }

  const handleRemove = () => {
    if (canRemove) {
      removeSection(section.id)
    }
  }

  const handleTabSelect = (tabId: string) => {
    assignTabToSection(section.id, tabId)
  }

  const handleDirectPageAssign = (url: string, title: string, existingTabId?: string) => {
    if (isTabModeEnabled) {
      if (existingTabId) {
        // Se viene fornito un ID di scheda esistente, collegala direttamente
        assignTabToSection(section.id, existingTabId)

        // If we're currently on the grid tab, keep it active
        if (activeTabId === 'grid-tab') {
          setActiveTab('grid-tab')
        }
      } else {
        // When tab mode is enabled, create tab in background without activating it
        const tabId = openTabInBackground(url, title)
        if (tabId) {
          assignTabToSection(section.id, tabId)

          // If we're currently on the grid tab, keep it active
          if (activeTabId === 'grid-tab') {
            setActiveTab('grid-tab')
          }
        }
      }
    } else {
      // When tab mode is disabled, use the virtual page system
      assignVirtualPageToSection(section.id, url, title)
    }
  }


  const handleClearTab = () => {
    clearSectionTab(section.id)
  }

  const handleDetachTab = () => {
    clearSectionTab(section.id)
  }

  const handleCloseSection = () => {
    if (canRemove) {
      closeSection(section.id)
    }
  }

  const handleExpandSection = () => {
    if (!assignedTab) return

    const existingTab = tabs.find(tab => tab.id === assignedTab.id)

    if (existingTab) {
      // CASO 2: È una scheda reale - riabilita modalità schede e vai alla scheda
      if (!isTabModeEnabled) {
        toggleTabMode()
      }
      setActiveTab(assignedTab.id)
    } else {
      // CASO 1: È un collegamento diretto (pagina virtuale) - disabilita tutto e naviga
      if (isTabModeEnabled) {
        toggleTabMode()
      }
      if (isGridModeEnabled) {
        toggleGridMode()
      }
      router.push(assignedTab.url)
    }
  }

  // Gestione drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()

    // Controlla l'effectAllowed per determinare il dropEffect appropriato
    if (e.dataTransfer.effectAllowed === 'copy') {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'move'
    }

    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const dragData = e.dataTransfer.getData('text/plain')

    // Controlla se è un menu item (formato: menu-item::url::title)
    if (dragData.startsWith('menu-item::')) {
      const parts = dragData.split('::')
      if (parts.length === 3) {
        const url = parts[1]
        const title = parts[2]
        handleDirectPageAssign(url, title)
        return
      }
    }

    // Gestisce il drop di una scheda normale
    if (dragData && dragData !== 'grid-tab') {
      assignTabToSection(section.id, dragData)
    }
  }


  return (
    <div
      className={cn(
        "relative bg-background h-full w-full flex flex-col p-2",
        isActive && assignedTab && "ring-1 ring-primary/20", // Ring solo se ha contenuto
        isDragOver && "bg-primary/5"
      )}
      onClick={handleSectionClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header con controlli */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {assignedTab && (
            (() => {
              const PageIcon = getPageIcon(assignedTab.url)
              return <PageIcon className="h-3 w-3 text-primary flex-shrink-0" />
            })()
          )}
          <span className={cn(
            "text-xs",
            assignedTab ? "font-medium" : "text-muted-foreground/60 font-normal italic"
          )}>
            {getDisplayTitle(assignedTab)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Split verticale */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleSplitVertical}
            disabled={!canSplitVertical}
            title="Dividi verticalmente"
          >
            <GripVertical className="h-3 w-3" />
          </Button>

          {/* Split orizzontale */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleSplitHorizontal}
            disabled={!canSplitHorizontal}
            title="Dividi orizzontalmente"
          >
            <GripHorizontal className="h-3 w-3" />
          </Button>

          {/* Pulsante Espandi - solo se c'è contenuto assegnato */}
          {assignedTab && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleExpandSection}
              title="Espandi sezione"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}

          {/* Pulsante intelligente: Attach/Detach/Close */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              assignedTab ? "hover:bg-destructive hover:text-destructive-foreground" : ""
            )}
            onClick={() => {
              if (assignedTab) {
                // Se c'è una tab assegnata, detach (diventa X per chiudere)
                handleDetachTab()
              } else if (canRemove) {
                // Se non c'è tab e può essere rimossa, chiudi sezione
                handleCloseSection()
              }
              // Se non c'è tab e non può essere rimossa, non fare nulla (stato base)
            }}
            title={
              assignedTab
                ? "Scollega pagina dalla sezione"
                : canRemove
                  ? "Chiudi sezione"
                  : "Sezione principale"
            }
            disabled={!assignedTab && !canRemove}
          >
            {assignedTab ? (
              <Link2Off className="h-3 w-3" />
            ) : canRemove ? (
              <X className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3 opacity-30" />
            )}
          </Button>
        </div>
      </div>

      {/* Contenuto della sezione */}
      <div className="flex-1 flex flex-col">
        {assignedTab ? (
          <div className="flex-1 min-h-0">
            <TabContentRenderer tab={assignedTab} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <PageSelector onPageSelect={handleDirectPageAssign} />

            {isTabModeEnabled && (
              <div className="text-xs text-center text-muted-foreground/70 mt-4">
                oppure trascina una scheda qui
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}