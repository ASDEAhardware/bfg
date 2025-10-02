"use client"
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Edit3, Check, GripVertical, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, renameTab, reorderTabs } = useTabStore()
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)
  const [visibleTabs, setVisibleTabs] = useState<typeof tabs>([])
  const [overflowTabs, setOverflowTabs] = useState<typeof tabs>([])

  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // Calcola quali schede sono visibili e quali vanno nel dropdown
  const calculateTabVisibility = useCallback(() => {
    if (!tabsContainerRef.current || tabs.length === 0) {
      setVisibleTabs(tabs)
      setOverflowTabs([])
      return
    }

    const container = tabsContainerRef.current
    const containerWidth = container.clientWidth || 800 // fallback

    // Larghezza fissa per ogni scheda (w-36 = 144px + border)
    const tabWidth = 145 // w-36 + border
    const dropdownButtonWidth = tabs.length > 1 ? 40 : 0 // Solo se necessario

    // Calcola quante schede possono entrare - minimo 1
    const availableWidth = containerWidth - dropdownButtonWidth
    const maxVisibleTabs = Math.max(1, Math.floor(availableWidth / tabWidth))

    // Assicurati che la scheda attiva sia sempre visibile
    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTabId)

    if (tabs.length <= maxVisibleTabs) {
      // Tutte le schede sono visibili
      setVisibleTabs(tabs)
      setOverflowTabs([])
    } else {
      // Alcune schede vanno nel dropdown
      let startIndex = 0

      // Se la scheda attiva esiste, assicurati che sia visibile
      if (activeTabIndex !== -1) {
        // Se la scheda attiva è l'ultima (nuova), mostrala nelle prime posizioni
        if (activeTabIndex === tabs.length - 1) {
          // Scheda nuova: mostra le ultime schede inclusa quella attiva
          startIndex = Math.max(0, tabs.length - maxVisibleTabs)
        } else {
          // Scheda esistente: centrala nelle schede visibili
          const halfVisible = Math.floor(maxVisibleTabs / 2)
          startIndex = Math.max(0, activeTabIndex - halfVisible)
          startIndex = Math.min(startIndex, tabs.length - maxVisibleTabs)
        }
      }

      const endIndex = startIndex + maxVisibleTabs
      setVisibleTabs(tabs.slice(startIndex, endIndex))
      setOverflowTabs([
        ...tabs.slice(0, startIndex),
        ...tabs.slice(endIndex)
      ])
    }
  }, [tabs, activeTabId])

  useEffect(() => {
    // Aspetta che il DOM sia renderizzato prima di calcolare
    const timeoutId = setTimeout(calculateTabVisibility, 50)
    return () => clearTimeout(timeoutId)
  }, [tabs, activeTabId, calculateTabVisibility])

  useEffect(() => {
    const handleResize = () => {
      setTimeout(calculateTabVisibility, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateTabVisibility])

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    closeTab(tabId)
  }

  const startEditing = (e: React.MouseEvent, tabId: string, currentTitle: string) => {
    e.stopPropagation()
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing()
    } else if (e.key === 'Escape') {
      setEditingTab(null)
      setEditValue('')
    }
  }

  // Gestione del drag-and-drop
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTab(tabId)
  }

  const handleDragLeave = () => {
    setDragOverTab(null)
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()

    if (!draggedTab || draggedTab === targetTabId) {
      setDraggedTab(null)
      setDragOverTab(null)
      return
    }

    const fromIndex = tabs.findIndex(tab => tab.id === draggedTab)
    const toIndex = tabs.findIndex(tab => tab.id === targetTabId)

    if (fromIndex !== -1 && toIndex !== -1) {
      reorderTabs(fromIndex, toIndex)
    }

    setDraggedTab(null)
    setDragOverTab(null)
  }

  const handleDragEnd = () => {
    setDraggedTab(null)
    setDragOverTab(null)
  }

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center bg-muted/30 border-b border-border h-8 relative w-full overflow-hidden">
      {/* Container delle schede visibili */}
      <div
        ref={tabsContainerRef}
        className="flex-1 flex h-8 min-w-0 overflow-hidden"
      >
        {visibleTabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const displayTitle = tab.customTitle || tab.title
            const isDragging = draggedTab === tab.id
            const isDragOver = dragOverTab === tab.id

            return (
              <div
                key={tab.id}
                draggable={editingTab !== tab.id}
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center w-36 h-8 px-2 cursor-pointer border-r border-border bg-muted/50 hover:bg-muted/70 transition-colors group relative flex-shrink-0",
                  isActive && "bg-background border-t-2 border-t-primary",
                  isDragging && "opacity-50",
                  isDragOver && "bg-primary/10"
                )}
                onClick={() => handleTabClick(tab.id)}
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
                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-1 cursor-grab" />
                    <span
                      className="flex-1 text-xs font-medium truncate pr-1"
                      title={displayTitle}
                    >
                      {displayTitle}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0.5 hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => startEditing(e, tab.id, displayTitle)}
                      >
                        <Edit3 className="h-3 w-3 p-0.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleCloseTab(e, tab.id)}
                      >
                          <X className="h-3 w-3" />
                      </Button>
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
              const displayTitle = tab.customTitle || tab.title
              const isActive = tab.id === activeTabId

              return (
                <DropdownMenuItem
                  key={tab.id}
                  className={cn(
                    "flex items-center justify-between cursor-pointer",
                    isActive && "bg-accent"
                  )}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <span className="truncate flex-1" title={displayTitle}>
                    {displayTitle}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-2 flex-shrink-0"
                    onClick={(e) => {
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
    </div>
  )
}