"use client"
import React from 'react'
import { Tab } from '@/store/tabStore'

// Import page components
import DashboardPage from '@/app/(private)/(guest)/dashboard/page'
import SettingsPage from '@/app/(private)/(guest)/settings/page'

interface TabContentRendererProps {
  tab: Tab
}

export function TabContentRenderer({ tab }: TabContentRendererProps) {
  // Handle virtual tabs created for grid sections
  const isVirtualTab = tab.id.startsWith('grid-page-')

  // Map URLs to their corresponding page components
  const renderContent = () => {
    // For virtual tabs, extract URL from tab ID if needed
    let url = tab.url
    if (isVirtualTab && !url) {
      // Extract URL from virtual tab ID
      const urlPart = tab.id.replace('grid-page-', '').split('-')[0]
      url = `/${urlPart}`
    }

    switch (url) {
      case '/dashboard':
        return <DashboardPage />
      case '/settings':
        return <SettingsPage />
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-sm font-medium">{tab.customTitle || tab.title}</p>
              <p className="text-xs mt-1">Contenuto non disponibile</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="h-full w-full overflow-auto">
      {renderContent()}
    </div>
  )
}