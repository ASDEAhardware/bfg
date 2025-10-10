"use client"
import React from 'react'
import { useSidebar } from '@/components/ui/sidebar'

interface StatusBarItem {
  label: string
  value: string | number
  color?: 'default' | 'success' | 'warning' | 'error'
}

interface ContextualStatusBarProps {
  leftItems: StatusBarItem[]
  rightItems?: StatusBarItem[]
  className?: string
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

  // Calcola la posizione left in base allo stato della sidebar
  const getLeftPosition = () => {
    if (isMobile) return 'left-0'
    return state === 'collapsed' ? 'left-12' : 'left-64'
  }

  return (
    <div className={`fixed bottom-0 ${getLeftPosition()} right-0 bg-sidebar border-t border-sidebar-border px-2 py-1 z-10 transition-[left] duration-200 ease-linear ${className}`}>
      <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
        {/* Left side items */}
        <div className="flex items-center gap-4">
          {leftItems.map((item, index) => (
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
  return {
    // Per pagine con dati di conteggio
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