"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface GridSection {
  id: string
  tabId: string | null // ID della scheda assegnata a questa sezione
  row: number
  col: number
  // Per supportare la divisione interna
  rowSpan?: number
  colSpan?: number
  // Per sezioni divise
  children?: GridSection[]
  direction?: 'horizontal' | 'vertical' // direzione della divisione
}

export interface GridLayout {
  id: string
  sections: GridSection[]
  rows: number
  cols: number
}

interface VirtualPage {
  id: string
  title: string
  url: string
}

interface GridState {
  isGridModeEnabled: boolean
  currentLayout: GridLayout | null
  activeSectionId: string | null
  virtualPages: Record<string, VirtualPage> // Record per le pagine virtuali

  // Actions
  toggleGridMode: () => void
  initializeGrid: () => void
  splitSection: (sectionId: string, direction: 'horizontal' | 'vertical') => void
  removeSection: (sectionId: string) => void
  assignTabToSection: (sectionId: string, tabId: string) => void
  assignVirtualPageToSection: (sectionId: string, url: string, title: string) => void
  clearSectionTab: (sectionId: string) => void
  setActiveSection: (sectionId: string) => void
  resetGrid: () => void
  closeSection: (sectionId: string) => void
  getVirtualPage: (tabId: string) => VirtualPage | null
}

// Utility per generare ID unici
const generateId = () => `grid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Crea layout iniziale con una singola sezione
const createInitialLayout = (): GridLayout => ({
  id: generateId(),
  sections: [
    {
      id: generateId(),
      tabId: null,
      row: 0,
      col: 0
    }
  ],
  rows: 1,
  cols: 1
})

export const useGridStore = create<GridState>()(
  persist(
    (set, get) => ({
      isGridModeEnabled: false,
      currentLayout: null,
      activeSectionId: null,
      virtualPages: {},

      toggleGridMode: () => {
        const state = get()

        if (state.isGridModeEnabled) {
          // Disabilitazione: preserva tutto lo stato, cambia solo il flag
          set({
            isGridModeEnabled: false
            // Preserviamo currentLayout, activeSectionId, virtualPages
          })
        } else {
          // Abilitazione: se non c'è un layout, crealo; altrimenti ripristina quello esistente
          const layout = state.currentLayout || createInitialLayout()
          const activeSectionId = state.activeSectionId || layout.sections[0].id

          set({
            isGridModeEnabled: true,
            currentLayout: layout,
            activeSectionId: activeSectionId
          })
        }
      },

      initializeGrid: () => {
        const initialLayout = createInitialLayout()
        set({
          currentLayout: initialLayout,
          activeSectionId: initialLayout.sections[0].id
        })
      },

      splitSection: (sectionId: string, direction: 'horizontal' | 'vertical') => {
        const state = get()
        if (!state.currentLayout) return

        console.log('Splitting section:', sectionId, 'direction:', direction)

        // Funzione ricorsiva per trovare e dividere la sezione
        const splitSectionRecursive = (sections: GridSection[]): GridSection[] => {
          return sections.map(section => {
            // Se questa è la sezione da dividere
            if (section.id === sectionId) {
              console.log('Found section to split:', section)
              // Se la sezione non ha children, creali
              if (!section.children || section.children.length === 0) {
                const firstChild: GridSection = {
                  id: generateId(),
                  tabId: section.tabId, // Mantieni il tab nella prima sezione
                  row: 0,
                  col: 0
                }

                const secondChild: GridSection = {
                  id: generateId(),
                  tabId: null,
                  row: direction === 'horizontal' ? 1 : 0,
                  col: direction === 'vertical' ? 1 : 0
                }

                return {
                  ...section,
                  tabId: null, // Rimuovi il tab dalla sezione padre
                  children: [firstChild, secondChild],
                  direction: direction
                }
              } else {
                // Se ha già children, sostituisci la sezione con i suoi children divisi
                // In questo caso, dividiamo la sezione esistente in una nuova struttura
                const newChild: GridSection = {
                  id: generateId(),
                  tabId: null,
                  row: direction === 'horizontal' ? section.children.length : 0,
                  col: direction === 'vertical' ? section.children.length : 0
                }

                return {
                  ...section,
                  children: [...section.children, newChild],
                  direction: direction
                }
              }
            }

            // Se ha children, cerca ricorsivamente
            if (section.children) {
              return {
                ...section,
                children: splitSectionRecursive(section.children)
              }
            }

            return section
          })
        }

        const newSections = splitSectionRecursive(state.currentLayout.sections)

        set({
          currentLayout: {
            ...state.currentLayout,
            sections: newSections
          }
        })
      },

      removeSection: (sectionId: string) => {
        const state = get()
        if (!state.currentLayout || state.currentLayout.sections.length <= 1) return

        const sections = state.currentLayout.sections.filter(s => s.id !== sectionId)

        // Se rimuoviamo la sezione attiva, seleziona la prima disponibile
        let newActiveSectionId = state.activeSectionId
        if (state.activeSectionId === sectionId) {
          newActiveSectionId = sections[0]?.id || null
        }

        set({
          currentLayout: {
            ...state.currentLayout,
            sections
          },
          activeSectionId: newActiveSectionId
        })
      },

      assignTabToSection: (sectionId: string, tabId: string) => {
        const state = get()
        if (!state.currentLayout) return

        // Funzione ricorsiva per cercare e aggiornare sezioni
        const updateSections = (sections: GridSection[]): GridSection[] => {
          return sections.map(section => {
            // Se questa sezione ha il tab assegnato, rimuovilo
            let updatedSection = {
              ...section,
              tabId: section.tabId === tabId ? null : section.tabId
            }

            // Se ha children, cerca ricorsivamente
            if (section.children) {
              updatedSection.children = updateSections(section.children)
            }

            // Se questa è la sezione target, assegna il tab
            if (section.id === sectionId) {
              updatedSection.tabId = tabId
            }

            return updatedSection
          })
        }

        const updatedSections = updateSections(state.currentLayout.sections)

        set({
          currentLayout: {
            ...state.currentLayout,
            sections: updatedSections
          }
        })
      },

      assignVirtualPageToSection: (sectionId: string, url: string, title: string) => {
        const state = get()
        const tabId = `grid-page-${url.replace('/', '') || 'root'}-${Date.now()}`

        // Store the virtual page info
        const newVirtualPages = { ...state.virtualPages }
        newVirtualPages[tabId] = { id: tabId, title, url }

        // Use the existing assignTabToSection logic
        if (state.currentLayout) {
          const updateSections = (sections: GridSection[]): GridSection[] => {
            return sections.map(section => {
              let updatedSection = {
                ...section,
                tabId: section.tabId === tabId ? null : section.tabId
              }

              if (section.children) {
                updatedSection.children = updateSections(section.children)
              }

              if (section.id === sectionId) {
                updatedSection.tabId = tabId
              }

              return updatedSection
            })
          }

          const updatedSections = updateSections(state.currentLayout.sections)

          set({
            currentLayout: {
              ...state.currentLayout,
              sections: updatedSections
            },
            virtualPages: newVirtualPages
          })
        } else {
          set({ virtualPages: newVirtualPages })
        }
      },

      getVirtualPage: (tabId: string) => {
        const state = get()
        return state.virtualPages[tabId] || null
      },

      clearSectionTab: (sectionId: string) => {
        const state = get()
        if (!state.currentLayout) return

        // Funzione ricorsiva per cercare e pulire sezioni
        const clearSections = (sections: GridSection[]): GridSection[] => {
          return sections.map(section => {
            let updatedSection = { ...section }

            // Se questa è la sezione target, rimuovi il tab
            if (section.id === sectionId) {
              updatedSection.tabId = null
            }

            // Se ha children, cerca ricorsivamente
            if (section.children) {
              updatedSection.children = clearSections(section.children)
            }

            return updatedSection
          })
        }

        const updatedSections = clearSections(state.currentLayout.sections)

        set({
          currentLayout: {
            ...state.currentLayout,
            sections: updatedSections
          }
        })
      },

      setActiveSection: (sectionId: string) => {
        set({ activeSectionId: sectionId })
      },

      resetGrid: () => {
        const initialLayout = createInitialLayout()
        set({
          currentLayout: initialLayout,
          activeSectionId: initialLayout.sections[0].id
        })
      },

      closeSection: (sectionId: string) => {
        const state = get()
        if (!state.currentLayout) return

        // Funzione ricorsiva per chiudere una sezione
        const closeSectionRecursive = (sections: GridSection[]): GridSection[] => {
          return sections.map(section => {
            // Se questa sezione ha children, verifica se uno di essi è quello da chiudere
            if (section.children && section.children.length > 0) {
              // Se uno dei children è quello da chiudere
              if (section.children.some(child => child.id === sectionId)) {
                // Rimuovi il child specifico
                const remainingChildren = section.children.filter(child => child.id !== sectionId)

                // Se rimane solo un child, "collassa" la sezione
                if (remainingChildren.length === 1) {
                  const remainingChild = remainingChildren[0]
                  return {
                    ...section,
                    tabId: remainingChild.tabId, // Eredita il tab del child rimanente
                    children: remainingChild.children || undefined, // Eredita i children se esistono
                    direction: remainingChild.direction || section.direction
                  }
                } else if (remainingChildren.length === 0) {
                  // Se non ci sono children rimanenti, rimuovi tutti i children
                  return {
                    ...section,
                    children: undefined,
                    direction: undefined
                  }
                } else {
                  // Se ci sono ancora multiple children, mantieni la struttura
                  return {
                    ...section,
                    children: remainingChildren
                  }
                }
              } else {
                // Continua la ricerca ricorsiva nei children
                return {
                  ...section,
                  children: closeSectionRecursive(section.children)
                }
              }
            }

            return section
          }).filter(section => section.id !== sectionId) // Rimuovi la sezione se è quella da chiudere
        }

        const newSections = closeSectionRecursive(state.currentLayout.sections)

        // Se rimuoviamo la sezione attiva, seleziona un'altra sezione
        let newActiveSectionId = state.activeSectionId
        if (state.activeSectionId === sectionId) {
          // Trova la prima sezione disponibile
          const findFirstAvailableSection = (sections: GridSection[]): string | null => {
            for (const section of sections) {
              if (!section.children || section.children.length === 0) {
                return section.id
              } else {
                const childResult = findFirstAvailableSection(section.children)
                if (childResult) return childResult
              }
            }
            return null
          }
          newActiveSectionId = findFirstAvailableSection(newSections)
        }

        set({
          currentLayout: {
            ...state.currentLayout,
            sections: newSections
          },
          activeSectionId: newActiveSectionId
        })
      }
    }),
    {
      name: 'grid-storage',
      partialize: (state) => ({
        isGridModeEnabled: state.isGridModeEnabled,
        currentLayout: state.currentLayout,
        activeSectionId: state.activeSectionId
      })
    }
  )
)