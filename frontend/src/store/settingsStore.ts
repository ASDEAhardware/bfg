"use client"
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  showResizeHandle: boolean
  setShowResizeHandle: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showResizeHandle: true, // Default: visibile
      setShowResizeHandle: (show) => set({ showResizeHandle: show }),
    }),
    {
      name: 'bfg-settings-storage', // Nome per il localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
)
