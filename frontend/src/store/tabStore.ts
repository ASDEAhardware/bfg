"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tab {
  id: string
  title: string
  url: string
  isActive: boolean
  customTitle?: string
}

interface TabState {
  isTabModeEnabled: boolean
  tabs: Tab[]
  activeTabId: string | null

  // Actions
  toggleTabMode: () => void
  openTab: (url: string, title: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, newTitle: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  clearAllTabs: () => void
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      isTabModeEnabled: false,
      tabs: [],
      activeTabId: null,

      toggleTabMode: () => {
        set((state) => ({
          isTabModeEnabled: !state.isTabModeEnabled,
          // Se disabilitiamo la modalità schede, resettiamo tutto
          ...(state.isTabModeEnabled && {
            tabs: [],
            activeTabId: null
          })
        }))
      },

      openTab: (url: string, title: string) => {
        const state = get()

        // Se non siamo in modalità schede, non facciamo nulla
        if (!state.isTabModeEnabled) return

        // Genera un ID unico per la scheda usando timestamp
        const timestamp = Date.now()
        const existingTabs = state.tabs.filter(tab => tab.url === url)
        let tabId = url
        let displayTitle = title

        if (existingTabs.length > 0) {
          tabId = `${url}-${timestamp}`
          displayTitle = `${title} (${existingTabs.length + 1})`
        }

        const newTab: Tab = {
          id: tabId,
          title: displayTitle,
          url,
          isActive: true
        }

        set((state) => ({
          tabs: [
            ...state.tabs.map(tab => ({ ...tab, isActive: false })),
            newTab
          ],
          activeTabId: tabId
        }))
      },

      closeTab: (tabId: string) => {
        const state = get()
        const tabIndex = state.tabs.findIndex(tab => tab.id === tabId)

        if (tabIndex === -1) return

        const newTabs = state.tabs.filter(tab => tab.id !== tabId)
        let newActiveTabId = state.activeTabId

        // Se chiudiamo la scheda attiva, dobbiamo selezionare un'altra scheda
        if (state.activeTabId === tabId) {
          if (newTabs.length > 0) {
            // Seleziona la scheda precedente o la prima disponibile
            const newActiveIndex = Math.max(0, tabIndex - 1)
            newActiveTabId = newTabs[newActiveIndex]?.id || null
          } else {
            newActiveTabId = null
          }
        }

        set({
          tabs: newTabs.map(tab => ({
            ...tab,
            isActive: tab.id === newActiveTabId
          })),
          activeTabId: newActiveTabId
        })
      },

      setActiveTab: (tabId: string) => {
        set((state) => ({
          tabs: state.tabs.map(tab => ({
            ...tab,
            isActive: tab.id === tabId
          })),
          activeTabId: tabId
        }))
      },

      renameTab: (tabId: string, newTitle: string) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId
              ? { ...tab, customTitle: newTitle }
              : tab
          )
        }))
      },

      reorderTabs: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const newTabs = [...state.tabs]
          const [removed] = newTabs.splice(fromIndex, 1)
          newTabs.splice(toIndex, 0, removed)
          return { tabs: newTabs }
        })
      },

      clearAllTabs: () => {
        set({
          tabs: [],
          activeTabId: null
        })
      }
    }),
    {
      name: 'tab-storage',
      partialize: (state) => ({
        isTabModeEnabled: state.isTabModeEnabled,
        tabs: state.tabs,
        activeTabId: state.activeTabId
      })
    }
  )
)