"use client"
import React from 'react'
import { Tab } from '@/store/tabStore'
import { TabSiteProvider } from '@/contexts/TabSiteContext'
import { TabContentRenderer } from '@/components/TabContentRenderer'
import { TabContextHeader } from '@/components/TabContextHeader'

interface TabContentWithProviderProps {
  tab: Tab
  showContextHeader?: boolean
  showDiagnostics?: boolean
}

/**
 * Wrapper che fornisce il TabSiteProvider a ogni tab individuale.
 * Questo è il punto di integrazione tra il sistema di tab esistente
 * e il nuovo sistema di contesto isolato per tab.
 */
export function TabContentWithProvider({
  tab,
  showContextHeader = true,
  showDiagnostics = false
}: TabContentWithProviderProps) {
  return (
    <TabSiteProvider tabId={tab.id}>
      <div className="h-full w-full flex flex-col">
        {showContextHeader && (
          <TabContextHeader
            tab={tab}
            showDiagnostics={showDiagnostics}
          />
        )}
        <div className="flex-1 overflow-auto">
          <TabContentRenderer tab={tab} />
        </div>
      </div>
    </TabSiteProvider>
  )
}