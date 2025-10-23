"use client"
import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

interface StatusBarItem {
  label: string
  value: string | number
  color?: 'default' | 'success' | 'warning' | 'error'
}

interface ContextualStatusBarProps {
  leftItems?: StatusBarItem[]
  rightItems?: StatusBarItem[]
  className?: string
}

interface StatusBarContextType {
  contextualItems: StatusBarItem[]
  setContextualItems: (items: StatusBarItem[]) => void
}

const StatusBarContext = createContext<StatusBarContextType | undefined>(undefined)

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [contextualItems, setContextualItems] = useState<StatusBarItem[]>([])

  return (
    <StatusBarContext.Provider value={{ contextualItems, setContextualItems }}>
      {children}
    </StatusBarContext.Provider>
  )
}

const colorClasses = {
  default: 'text-sidebar-foreground/70',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500'
}

export function ContextualStatusBar({
  leftItems,
  rightItems = [],
  className = ''
}: ContextualStatusBarProps) {
  const { state, isMobile } = useSidebar()
  const statusBarContext = useContext(StatusBarContext)

  // Use context items if available, otherwise fall back to props
  const itemsToShow = statusBarContext?.contextualItems || leftItems || []

  // Calcola la posizione left in base allo stato della sidebar
  const getLeftPosition = () => {
    if (isMobile) return 'left-0'
    return state === 'collapsed' ? 'left-12' : 'left-64'
  }

  // Don't render if no items
  if (itemsToShow.length === 0 && rightItems.length === 0) {
    return null
  }

  return (
    <div className={`fixed bottom-0 ${getLeftPosition()} right-0 bg-sidebar border-t border-sidebar-border px-2 py-1 z-10 transition-[left] duration-200 ease-linear ${className}`}>
      <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
        {/* Left side items */}
        <div className="flex items-center gap-4">
          {itemsToShow.map((item, index) => (
            <span
              key={index}
              className={colorClasses[item.color || 'default']}
            >
              {item.label}: {item.value}
            </span>
          ))}
        </div>

        {/* Right side items */}
        {rightItems.length > 0 && (
          <div className="flex items-center gap-4">
            {rightItems.map((item, index) => (
              <span
                key={index}
                className={colorClasses[item.color || 'default']}
              >
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Hook per facilitare l'uso in diverse pagine
export function useContextualStatusBar() {
  const context = useContext(StatusBarContext)

  if (!context) {
    throw new Error('useContextualStatusBar must be used within a StatusBarProvider')
  }

  const { contextualItems, setContextualItems } = context

  return {
    contextualItems,
    setContextualItems,

    // Helper functions per creare items comuni
    createCountItems: (total: number, active: number, inactive: number) => [
      { label: 'Totale', value: total },
      { label: 'Online', value: active, color: 'success' as const },
      { label: 'Offline', value: inactive, color: 'error' as const }
    ],

    // Per pagine con filtri
    createFilterItems: (filtered: number, searchTerm?: string) =>
      searchTerm ? [{ label: 'Filtrati', value: filtered }] : [],

    // Per pagine con operazioni
    createOperationItems: (operation: string, status: 'idle' | 'loading' | 'success' | 'error') => [
      {
        label: operation,
        value: status,
        color: status === 'loading' ? 'warning' : status === 'error' ? 'error' : 'success'
      }
    ],

    // Per pagine con utenti/sessioni
    createUserItems: (users: number, sessions: number) => [
      { label: 'Utenti', value: users },
      { label: 'Sessioni', value: sessions, color: 'success' as const }
    ],

    // Per pagine con file/documenti
    createFileItems: (files: number, size: string) => [
      { label: 'File', value: files },
      { label: 'Dimensione', value: size }
    ]
  }
}