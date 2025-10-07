"use client"
import { useRouter } from 'next/navigation'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'

export function useSmartNavigation() {
  const router = useRouter()
  const { isTabModeEnabled, openTabInBackground, toggleTabMode } = useTabStore()
  const { isGridModeEnabled, toggleGridMode } = useGridStore()

  const navigateIntelligently = (url: string, title: string) => {
    if (isTabModeEnabled && !isGridModeEnabled) {
      // Solo modalità tab: apri in nuova scheda
      openTabInBackground(url, title)
    } else if (isGridModeEnabled) {
      // Modalità grid attiva: chiudi tutto e naviga in full-screen
      if (isTabModeEnabled) {
        toggleTabMode()
      }
      toggleGridMode()
      router.push(url)
    } else {
      // Modalità normale: navigazione standard
      router.push(url)
    }
  }

  return {
    navigateIntelligently,
    isTabModeEnabled,
    isGridModeEnabled
  }
}