"use client"
import React from 'react'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'
import Breadcrumb from '@/components/Breadcrumb'

export default function TabAwareBreadcrumb() {
  const { isTabModeEnabled, tabs, activeTabId } = useTabStore()
  const { isGridModeEnabled } = useGridStore()

  // Se modalità griglia attiva senza modalità schede
  if (isGridModeEnabled && !isTabModeEnabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
          Modalità griglia attiva
        </span>
      </div>
    )
  }

  // Se non siamo in modalità schede, mostra la breadcrumb normale
  if (!isTabModeEnabled) {
    return <Breadcrumb />
  }

  // Se siamo in modalità schede, mostra un indicatore e il titolo della scheda attiva
  const activeTab = tabs.find(tab => tab.id === activeTabId)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
        Modalità schede attiva
      </span>
      {activeTab && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="font-medium text-sm">
            {activeTab.customTitle || activeTab.title}
          </span>
        </>
      )}
    </div>
  )
}