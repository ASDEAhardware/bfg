"use client"
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { X, Edit3, Check, MoreHorizontal, Grid3X3, GripVertical, SquareChartGantt, LayoutDashboard, Shield, MonitorCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { pluginRegistry, getUserPermissions } from '@/plugins'
import { useUserInfo } from '@/hooks/useAuth'

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, renameTab, reorderTabs, closeOtherTabs, closeTabsToRight, closeTabsToLeft, closeAllTabs, isTabModeEnabled } = useTabStore()
  const { isGridModeEnabled } = useGridStore()
  const { data: userData } = useUserInfo()
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [visibleTabs, setVisibleTabs] = useState<typeof tabs>([])
  const [overflowTabs, setOverflowTabs] = useState<typeof tabs>([])
  const [contextMenuTab, setContextMenuTab] = useState<string | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)

  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // Combina scheda griglia con le schede normali
  const allTabs = useMemo(() => {
    // Crea la scheda griglia solo se sia il grid mode che il tab mode sono attivi
    const gridTab = (isGridModeEnabled && isTabModeEnabled) ? {
      id: 'grid-tab',
      title: '', // Solo icona, nessun titolo
      url: '/grid',
      isActive: activeTabId === 'grid-tab',
      customTitle: ''
    } : null

    return gridTab ? [gridTab, ...tabs] : tabs
  }, [isGridModeEnabled, isTabModeEnabled, activeTabId, tabs])

  // Calcola quali schede sono visibili e quali vanno nel dropdown
  const calculateTabVisibility = useCallback(() => {
    if (!tabsContainerRef.current || allTabs.length === 0) {
      setVisibleTabs(allTabs)
      setOverflowTabs([])
      return
    }

    const container = tabsContainerRef.current
    const containerWidth = container.clientWidth || 800 // fallback

    // Larghezza dinamica per le schede
    const gridTabWidth = 49 // w-12 + border per la scheda griglia
    const normalTabWidth = 145 // w-36 + border per schede normali
    const dropdownButtonWidth = allTabs.length > 1 ? 40 : 0 // Solo se necessario

    // Calcola quante schede possono entrare considerando la griglia
    const availableWidth = containerWidth - dropdownButtonWidth
    const hasGridTab = allTabs[0]?.id === 'grid-tab'

    let maxVisibleTabs
    if (hasGridTab) {
      // Riserva spazio per la scheda griglia
      const remainingWidth = availableWidth - gridTabWidth
      const maxOtherTabs = Math.max(0, Math.floor(remainingWidth / normalTabWidth))
      maxVisibleTabs = maxOtherTabs + 1 // +1 per la griglia
    } else {
      maxVisibleTabs = Math.max(1, Math.floor(availableWidth / normalTabWidth))
    }

    // Assicurati che la scheda attiva sia sempre visibile
    const activeTabIndex = allTabs.findIndex(tab => tab.id === activeTabId)

    if (allTabs.length <= maxVisibleTabs) {
      // Tutte le schede sono visibili
      setVisibleTabs(allTabs)
      setOverflowTabs([])
    } else {
      // Alcune schede vanno nel dropdown
      const hasGridTab = allTabs[0]?.id === 'grid-tab'

      if (hasGridTab) {
        // Se c'è la scheda griglia, assicurati che sia sempre visibile come prima
        const gridTab = allTabs[0]
        const otherTabs = allTabs.slice(1)
        const maxOtherTabs = maxVisibleTabs - 1 // Riserva uno spazio per la griglia

        let visibleOtherTabs: typeof otherTabs = []
        let overflowOtherTabs: typeof otherTabs = []

        if (otherTabs.length <= maxOtherTabs) {
          visibleOtherTabs = otherTabs
          overflowOtherTabs = []
        } else {
          // Trova l'indice della scheda attiva tra le altre schede
          const activeOtherIndex = otherTabs.findIndex(tab => tab.id === activeTabId)

          if (activeOtherIndex !== -1) {
            // Centra la scheda attiva nelle schede visibili
            const halfVisible = Math.floor(maxOtherTabs / 2)
            let startIndex = Math.max(0, activeOtherIndex - halfVisible)
            startIndex = Math.min(startIndex, otherTabs.length - maxOtherTabs)

            const endIndex = startIndex + maxOtherTabs
            visibleOtherTabs = otherTabs.slice(startIndex, endIndex)
            overflowOtherTabs = [
              ...otherTabs.slice(0, startIndex),
              ...otherTabs.slice(endIndex)
            ]
          } else {
            // Nessuna scheda attiva, mostra le prime
            visibleOtherTabs = otherTabs.slice(0, maxOtherTabs)
            overflowOtherTabs = otherTabs.slice(maxOtherTabs)
          }
        }

        setVisibleTabs([gridTab, ...visibleOtherTabs])
        setOverflowTabs(overflowOtherTabs)
      } else {
        // Logica normale senza scheda griglia
        let startIndex = 0

        if (activeTabIndex !== -1) {
          if (activeTabIndex === allTabs.length - 1) {
            startIndex = Math.max(0, allTabs.length - maxVisibleTabs)
          } else {
            const halfVisible = Math.floor(maxVisibleTabs / 2)
            startIndex = Math.max(0, activeTabIndex - halfVisible)
            startIndex = Math.min(startIndex, allTabs.length - maxVisibleTabs)
          }
        }

        const endIndex = startIndex + maxVisibleTabs
        setVisibleTabs(allTabs.slice(startIndex, endIndex))
        setOverflowTabs([
          ...allTabs.slice(0, startIndex),
          ...allTabs.slice(endIndex)
        ])
      }
    }
  }, [allTabs, activeTabId])

  useEffect(() => {
    // Aspetta che il DOM sia renderizzato prima di calcolare
    const timeoutId = setTimeout(calculateTabVisibility, 50)
    return () => clearTimeout(timeoutId)
  }, [allTabs, activeTabId, calculateTabVisibility])

  useEffect(() => {
    const handleResize = () => {
      setTimeout(calculateTabVisibility, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateTabVisibility])

  // Chiudi menu contestuale quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuPosition(null)
      setContextMenuTab(null)
    }

    if (contextMenuPosition) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenuPosition])

  // Non serve più aggiornare i customTitle, vengono gestiti alla creazione nel tabStore

  const handleTabClick = (tabId: string) => {
    if (tabId === 'grid-tab') {
      // Non è una scheda normale, gestisci solo come attiva
      setActiveTab(tabId)
    } else {
      setActiveTab(tabId)
    }
  }

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    if (tabId === 'grid-tab') {
      // La scheda griglia non può essere chiusa direttamente
      return
    }
    closeTab(tabId)
  }

  const startEditing = (e: React.MouseEvent, tabId: string, currentTitle: string) => {
    e.stopPropagation()
    if (tabId === 'grid-tab') {
      // La scheda griglia non può essere rinominata
      return
    }
    setEditingTab(tabId)
    setEditValue(currentTitle)
  }

  const finishEditing = () => {
    if (editingTab && editValue.trim()) {
      renameTab(editingTab, editValue.trim())
    }
    setEditingTab(null)
    setEditValue('')
  }

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    if (tabId === 'grid-tab') return // Non mostrare menu per la scheda griglia
    setContextMenuTab(tabId)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }

  const handleContextMenuAction = (action: string) => {
    if (!contextMenuTab) return

    switch (action) {
      case 'close':
        closeTab(contextMenuTab)
        break
      case 'closeOthers':
        closeOtherTabs(contextMenuTab)
        break
      case 'closeToRight':
        closeTabsToRight(contextMenuTab)
        break
      case 'closeToLeft':
        closeTabsToLeft(contextMenuTab)
        break
      case 'closeAll':
        closeAllTabs()
        break
    }

    setContextMenuPosition(null)
    setContextMenuTab(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing()
    } else if (e.key === 'Escape') {
      setEditingTab(null)
      setEditValue('')
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    if (tabId === 'grid-tab') return // La scheda griglia non può essere trascinata

    setDraggedTab(tabId)
    e.dataTransfer.setData('text/plain', tabId)
    e.dataTransfer.effectAllowed = 'move'

    // Aggiungi classe CSS per feedback visivo
    e.currentTarget.classList.add('opacity-50')
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTab(null)
    setDragOverTab(null)
    e.currentTarget.classList.remove('opacity-50')
  }

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    if (tabId === 'grid-tab' || tabId === draggedTab) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTab(tabId)
  }

  const handleDragLeave = () => {
    setDragOverTab(null)
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()

    if (targetTabId === 'grid-tab' || !draggedTab) return

    const draggedIndex = allTabs.findIndex(tab => tab.id === draggedTab)
    const targetIndex = allTabs.findIndex(tab => tab.id === targetTabId)

    // Adjusting for grid tab offset
    const gridOffset = allTabs[0]?.id === 'grid-tab' ? 1 : 0
    const realDraggedIndex = draggedIndex - gridOffset
    const realTargetIndex = targetIndex - gridOffset

    if (realDraggedIndex >= 0 && realTargetIndex >= 0 && realDraggedIndex !== realTargetIndex) {
      reorderTabs(realDraggedIndex, realTargetIndex)
    }

    setDraggedTab(null)
    setDragOverTab(null)
  }

  // Get plugin icon dynamically
  const getTabIcon = useMemo(() => {
    return (url: string) => {
      if (!userData) return SquareChartGantt

      // Check plugin icons first
      const userPermissions = getUserPermissions(userData)
      const pluginNavItems = pluginRegistry.getAllPluginNavItems(userPermissions)

      const pluginItem = pluginNavItems.find(item => item.url === url)
      if (pluginItem && pluginItem.icon) {
        return pluginItem.icon
      }

      // Fallback to static icons
      switch (url) {
        case '/dashboard':
          return LayoutDashboard
        case '/staff-admin':
          return Shield
        case '/system':
          return MonitorCog
        default:
          return SquareChartGantt
      }
    }
  }, [userData])

  // Funzione per determinare se una scheda ha un titolo custom (modificato dall'utente)
  const hasCustomTitle = (tab: any) => {
    // Se customTitle è diverso da title (che contiene la numerazione automatica)
    // E se customTitle non segue il pattern "Titolo Base (numero)"
    if (!tab.customTitle || !tab.baseTitle) return false

    // Verifica se il customTitle è diverso dal titolo auto-generato
    const autoTitle = tab.title // Questo è il titolo con numerazione automatica
    return tab.customTitle !== autoTitle
  }

  // Funzione per visualizzare titoli nelle schede
  const getTabDisplayTitle = (tab: any) => {
    if (hasCustomTitle(tab)) {
      // Se è un titolo custom, mostralo completo (verrà troncato dal CSS)
      return tab.customTitle
    }

    // Se è un titolo auto-generato, usa la compressione a 3 lettere
    const fullTitle = tab.customTitle || tab.title

    // Pattern per riconoscere titoli con numerazione: "Titolo Completo (numero)"
    const numberedPattern = /^(.+?)\s*\((\d+)\)$/
    const match = fullTitle.match(numberedPattern)

    if (match) {
      const titlePart = match[1].trim()
      const number = match[2]

      // Prendi le prime 3 lettere del titolo (solo lettere)
      const cleanTitle = titlePart.replace(/[^a-zA-Z]/g, '')
      const firstThreeLetters = cleanTitle.substring(0, 3)

      return `${firstThreeLetters}(${number})`
    }

    // Se non ha numerazione, prendi semplicemente le prime 3 lettere
    const cleanTitle = fullTitle.replace(/[^a-zA-Z]/g, '')
    const firstThreeLetters = cleanTitle.substring(0, 3)
    return firstThreeLetters || fullTitle
  }


  if (allTabs.length === 0) return null

  return (
    <div className="flex items-center bg-muted/30 border-b border-border h-8 relative w-full overflow-hidden">
      {/* Container delle schede visibili */}
      <div
        ref={tabsContainerRef}
        className="flex-1 flex h-8 min-w-0 overflow-hidden"
      >
        {visibleTabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isGridTab = tab.id === 'grid-tab'
            const displayTitle = isGridTab ? '' : getTabDisplayTitle(tab)
            const TabIcon = !isGridTab ? getTabIcon(tab.url) : null

            return (
              <div
                key={tab.id}
                draggable={!isGridTab}
                className={cn(
                  "flex items-center h-8 px-2 cursor-pointer border-r border-border bg-muted/50 hover:bg-muted/70 transition-colors group relative flex-shrink-0",
                  isGridTab ? "w-12" : "w-36", // Scheda griglia più piccola
                  isActive && "bg-background border-t-2 border-t-primary",
                  isGridTab && !isActive && "bg-primary/20", // Solo quando non è attiva
                  dragOverTab === tab.id && "border-l-4 border-l-primary", // Feedback visivo per drop
                  draggedTab === tab.id && "opacity-50", // Feedback per item trascinato
                )}
                onClick={() => handleTabClick(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tab.id)}
              >
                {editingTab === tab.id ? (
                  <div className="flex items-center flex-1 gap-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={finishEditing}
                      className="h-5 text-xs px-1 border-0 bg-transparent focus:bg-background"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      onClick={finishEditing}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    {isGridTab && (
                      <Grid3X3 className="h-4 w-4 text-primary mx-auto" />
                    )}
                    {!isGridTab && (
                      <div className="flex items-center flex-1 min-w-0">
                        <div
                          className="h-4 w-4 p-0.5 hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity mr-1 cursor-grab active:cursor-grabbing flex-shrink-0 rounded flex items-center justify-center"
                          title="Trascina per riordinare"
                        >
                          <GripVertical className="h-3 w-3" />
                        </div>
                        {TabIcon && <TabIcon className="h-3 w-3 mr-1 flex-shrink-0" />}
                        <span
                          className="flex-1 text-xs font-medium truncate pr-1"
                          title={tab.customTitle || tab.title}
                        >
                          {displayTitle}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      {!isGridTab && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0.5 hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e: React.MouseEvent) => startEditing(e, tab.id, tab.customTitle || tab.title)}
                          >
                            <Edit3 className="h-3 w-3 p-0.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e: React.MouseEvent) => handleCloseTab(e, tab.id)}
                          >
                              <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>


      {/* Dropdown per schede overflow */}
      {overflowTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 border-l bg-muted/50 hover:bg-muted/70 rounded-none"
              title={`${overflowTabs.length} schede nascoste`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {overflowTabs.map((tab) => {
              const displayTitle = getTabDisplayTitle(tab)
              const isActive = tab.id === activeTabId
              const TabIcon = getTabIcon(tab.url)

              return (
                <DropdownMenuItem
                  key={tab.id}
                  className={cn(
                    "flex items-center justify-between cursor-pointer",
                    isActive && "bg-accent"
                  )}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <TabIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span className="truncate flex-1" title={tab.customTitle || tab.title}>
                    {displayTitle}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-2 flex-shrink-0"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      handleCloseTab(e, tab.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Menu contestuale */}
      {contextMenuPosition && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[180px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleContextMenuAction('close')}
          >
            Chiudi scheda
          </button>
          <button
            className={cn(
              "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
              tabs.length <= 1 && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleContextMenuAction('closeOthers')}
            disabled={tabs.length <= 1}
          >
            Chiudi altre schede
          </button>
          <div className="border-t border-border my-1" />
          <button
            className={cn(
              "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
              (!contextMenuTab || tabs.findIndex(t => t.id === contextMenuTab) === 0) && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleContextMenuAction('closeToLeft')}
            disabled={!contextMenuTab || tabs.findIndex(t => t.id === contextMenuTab) === 0}
          >
            Chiudi schede a sinistra
          </button>
          <button
            className={cn(
              "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
              (!contextMenuTab || tabs.findIndex(t => t.id === contextMenuTab) === tabs.length - 1) && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleContextMenuAction('closeToRight')}
            disabled={!contextMenuTab || tabs.findIndex(t => t.id === contextMenuTab) === tabs.length - 1}
          >
            Chiudi schede a destra
          </button>
          <div className="border-t border-border my-1" />
          <button
            className={cn(
              "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
              tabs.length === 0 && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleContextMenuAction('closeAll')}
            disabled={tabs.length === 0}
          >
            Chiudi tutte le schede
          </button>
        </div>
      )}
    </div>
  )
}