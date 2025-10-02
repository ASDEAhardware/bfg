"use client"
import { useEffect } from 'react'
import { useTabStore } from '@/store/tabStore'
import { useRouter, usePathname } from 'next/navigation'

export function TabNavigationHandler() {
  const { isTabModeEnabled, tabs, activeTabId } = useTabStore()
  const router = useRouter()
  const pathname = usePathname()

  // Gestisce la navigazione quando cambia la scheda attiva
  useEffect(() => {
    if (!isTabModeEnabled || !activeTabId) return

    const activeTab = tabs.find(tab => tab.id === activeTabId)
    if (activeTab && pathname !== activeTab.url) {
      router.push(activeTab.url)
    }
  }, [activeTabId, isTabModeEnabled, router, tabs, pathname])

  return null
}