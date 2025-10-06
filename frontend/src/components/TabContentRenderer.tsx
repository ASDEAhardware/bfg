"use client"
import React, { useState, useEffect } from 'react'
import { Tab } from '@/store/tabStore'
import { pluginRegistry, getUserPermissions } from '@/plugins'
import { useUserInfo } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'

// Import page components
import DashboardPage from '@/app/(private)/(guest)/dashboard/page'
import SettingsPage from '@/app/(private)/(guest)/settings/page'

interface TabContentRendererProps {
  tab: Tab
}

export function TabContentRenderer({ tab }: TabContentRendererProps) {
  const { data: userData } = useUserInfo()
  const [PluginComponent, setPluginComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Handle virtual tabs created for grid sections
  const isVirtualTab = tab.id.startsWith('grid-page-')

  useEffect(() => {
    async function loadPluginComponent() {
      if (!userData) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Get URL to check
        let url = tab.url
        if (isVirtualTab && !url) {
          const urlPart = tab.id.replace('grid-page-', '').split('-')[0]
          url = `/${urlPart}`
        }

        // Check if it's a plugin route
        const userPermissions = getUserPermissions(userData)
        const pluginRoutes = pluginRegistry.getAllPluginRoutes(userPermissions)

        const matchingRoute = pluginRoutes.find(route => route.path === url)

        if (matchingRoute) {
          // It's a plugin route - load the component
          const module = await matchingRoute.component()
          setPluginComponent(() => module.default)
        } else {
          // Not a plugin route, will use static switch
          setPluginComponent(null)
        }
      } catch (err) {
        console.error('Error loading plugin component:', err)
        setError('Errore caricamento componente')
        setPluginComponent(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadPluginComponent()
  }, [tab.url, tab.id, userData, isVirtualTab])

  // Map URLs to their corresponding page components
  const renderContent = () => {
    // Show loading state
    if (isLoading) {
      return (
        <div className="flex justify-center p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      )
    }

    // Show error state
    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <p className="text-sm font-medium text-red-500">{error}</p>
            <p className="text-xs mt-1">Impossibile caricare il contenuto</p>
          </div>
        </div>
      )
    }

    // If we have a plugin component, render it
    if (PluginComponent) {
      return <PluginComponent />
    }

    // Fallback to static routes
    let url = tab.url
    if (isVirtualTab && !url) {
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