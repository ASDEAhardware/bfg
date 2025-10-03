"use client"
import React, { useState, useEffect } from 'react'
import { useTabStore } from '@/store/tabStore'
import { useGridStore } from '@/store/gridStore'
import { useSidebar } from '@/components/ui/sidebar'
import { useSmartNavigation } from '@/hooks/useSmartNavigation'
import { Wifi, WifiOff } from 'lucide-react'

export function StatusBar() {
  const { tabs, isTabModeEnabled } = useTabStore()
  const { isGridModeEnabled } = useGridStore()
  const { state, isMobile } = useSidebar()
  const { navigateIntelligently } = useSmartNavigation()

  const [isOnline, setIsOnline] = useState(true)

  // Monitora stato connessione
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('offline', updateOnlineStatus)

      return () => {
        window.removeEventListener('online', updateOnlineStatus)
        window.removeEventListener('offline', updateOnlineStatus)
      }
    }
  }, [])

  // Info modalità attiva
  const getCurrentMode = () => {
    if (isGridModeEnabled && isTabModeEnabled) return 'Grid + Tab'
    if (isGridModeEnabled) return 'Grid'
    if (isTabModeEnabled) return 'Tab'
    return 'Normal'
  }

  // Calcola il margine sinistro in base allo stato della sidebar
  const getSidebarOffset = () => {
    if (isMobile) return 'left-0' // Su mobile la sidebar si sovrappone
    return state === 'expanded' ? 'left-64' : 'left-12' // 16rem = 64, 3rem = 12
  }

  return (
    <div className={`fixed bottom-0 right-0 h-5 bg-muted/30 border-t border-border px-3 flex items-center justify-between text-xs text-muted-foreground select-none z-10 ${getSidebarOffset()}`}>
      {/* Sezione sinistra */}
      <div className="flex items-center space-x-4">
        {/* Stato connessione */}
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
          <span className={isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Modalità attiva */}
        <div className="flex items-center space-x-1">
          <span className="text-blue-600 dark:text-blue-400">{getCurrentMode()}</span>
        </div>

        {/* Numero schede */}
        {isTabModeEnabled && (
          <div className="flex items-center space-x-1">
            <span>{tabs.length} schede</span>
          </div>
        )}
      </div>

      {/* Sezione destra */}
      <div className="flex items-center space-x-2">
        {/* Copyright */}
        <span>© {new Date().getFullYear()} BFG</span>

        {/* Versione cliccabile con navigazione intelligente */}
        <button
          onClick={() => navigateIntelligently('/version', 'Changelog')}
          className="text-primary hover:text-primary/80 transition-colors hover:underline cursor-pointer"
        >
          v1.0.0
        </button>
      </div>
    </div>
  )
}