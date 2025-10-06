"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { pluginRegistry, getUserPermissions } from '@/plugins'
import { useUserInfo } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'

export function PluginRouteRenderer() {
  const pathname = usePathname()
  const { data: userData } = useUserInfo()
  const [PluginComponent, setPluginComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPluginComponent() {
      if (!userData) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const userPermissions = getUserPermissions(userData)
        const pluginRoutes = pluginRegistry.getAllPluginRoutes(userPermissions)

        const matchingRoute = pluginRoutes.find(route => {
          if (route.exact !== false) {
            return route.path === pathname
          } else {
            return pathname.startsWith(route.path)
          }
        })

        if (matchingRoute) {
          const module = await matchingRoute.component()
          setPluginComponent(() => module.default)
        } else {
          setPluginComponent(null)
        }
      } catch (err) {
        console.error('Error loading plugin component:', err)
        setError('Failed to load plugin component')
        setPluginComponent(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadPluginComponent()
  }, [pathname, userData])

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Skeleton className="h-10 w-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center p-6">
        <span className="text-red-500">{error}</span>
      </div>
    )
  }

  if (!PluginComponent) {
    return null // Let Next.js routing handle it
  }

  return <PluginComponent />
}