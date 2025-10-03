"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tab {
  id: string
  title: string
  url: string
  isActive: boolean
  customTitle?: string
  baseTitle?: string
}

interface TabState {
  isTabModeEnabled: boolean
  tabs: Tab[]
  activeTabId: string | null

  // Actions
  toggleTabMode: () => void
  openTab: (url: string, title: string) => void
  openTabInBackground: (url: string, title: string) => string // Returns the tab ID
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
          isTabModeEnabled: !state.isTabModeEnabled
          // Preserviamo sempre tabs e activeTabId, non resettiamo mai
        }))
      },

      openTab: (url: string, title: string) => {
        const state = get()

        // Se non siamo in modalità schede, non facciamo nulla
        if (!state.isTabModeEnabled) return

        // Genera un ID unico per la scheda usando timestamp
        const timestamp = Date.now()
        const tabId = `${url}-${timestamp}`

        // Trova schede con lo stesso titolo base per numerazione omonimie
        // Confronta con il baseTitle (proprietà che aggiungiamo per tenere traccia del titolo originale)
        const existingTabsWithSameBaseTitle = state.tabs.filter(tab => {
          // Se la tab ha baseTitle, usalo, altrimenti usa title rimuovendo numerazione
          const tabBaseTitle = (tab as any).baseTitle || tab.title.replace(/\s*\(\d+\)$/, '')
          return tabBaseTitle === title
        })

        // Calcola il titolo con numerazione per omonimie
        const finalTitle = existingTabsWithSameBaseTitle.length > 0
          ? `${title} (${existingTabsWithSameBaseTitle.length + 1})`
          : title

        const newTab: Tab = {
          id: tabId,
          title: finalTitle, // Titolo con numerazione
          url,
          isActive: true,
          customTitle: finalTitle, // Stesso del title
          baseTitle: title // Titolo base originale senza numerazione
        }

        set((state) => ({
          tabs: [
            ...state.tabs.map(tab => ({ ...tab, isActive: false })),
            newTab
          ],
          activeTabId: tabId
        }))
      },

      openTabInBackground: (url: string, title: string) => {
        const state = get()

        // Se non siamo in modalità schede, non facciamo nulla
        if (!state.isTabModeEnabled) return ''

        // Genera un ID unico per la scheda usando timestamp
        const timestamp = Date.now()
        const tabId = `${url}-${timestamp}`

        // Trova schede con lo stesso titolo base per numerazione omonimie
        const existingTabsWithSameBaseTitle = state.tabs.filter(tab => {
          // Se la tab ha baseTitle, usalo, altrimenti usa title rimuovendo numerazione
          const tabBaseTitle = (tab as any).baseTitle || tab.title.replace(/\s*\(\d+\)$/, '')
          return tabBaseTitle === title
        })

        // Calcola il titolo con numerazione per omonimie
        const finalTitle = existingTabsWithSameBaseTitle.length > 0
          ? `${title} (${existingTabsWithSameBaseTitle.length + 1})`
          : title

        const newTab: Tab = {
          id: tabId,
          title: finalTitle, // Titolo con numerazione
          url,
          isActive: false, // Non attivare la tab
          customTitle: finalTitle, // Stesso del title
          baseTitle: title // Titolo base originale senza numerazione
        }

        set((state) => ({
          tabs: [
            ...state.tabs, // Non disattivare le altre tab
            newTab
          ]
          // Non cambiare activeTabId
        }))

        return tabId // Ritorna l'ID per uso successivo
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
        const state = get()
        const newTabs = [...state.tabs]
        const [movedTab] = newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, movedTab)

        set({
          tabs: newTabs
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