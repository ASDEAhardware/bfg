"use client"
import React from 'react'
import { GridSection as GridSectionType, useGridStore } from '@/store/gridStore'
import { useSettingsStore } from '@/store/settingsStore' // Importa il nuovo store
import { GridSection } from '@/components/GridSection'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

interface RecursiveGridSectionProps {
  section: GridSectionType
  canSplitHorizontal: boolean
  canSplitVertical: boolean
  canRemove: boolean
}

export function RecursiveGridSection({
  section,
  canSplitHorizontal,
  canSplitVertical,
  canRemove
}: RecursiveGridSectionProps) {
  const { activeSectionId, currentLayout } = useGridStore()
  const { showResizeHandle } = useSettingsStore() // Leggi lo stato dallo store

  // Calcola se questa sezione può essere rimossa nel contesto ricorsivo
  const canRemoveSection = () => {
    // Se non ha children, può essere rimossa se non è l'ultima sezione globale
    if (!section.children || section.children.length === 0) {
      return canRemove // Usa la logica globale per sezioni foglia
    }

    // Se ha children, le sotto-sezioni possono sempre essere rimosse
    // (eccetto se rimane solo una sezione globale)
    return true
  }

  // Se la sezione non ha children, renderizza una sezione normale
  if (!section.children || section.children.length === 0) {
    return (
      <GridSection
        section={section}
        isActive={activeSectionId === section.id}
        canSplitHorizontal={canSplitHorizontal}
        canSplitVertical={canSplitVertical}
        canRemove={canRemoveSection()}
      />
    )
  }

  // Se ha children, renderizza un layout diviso
  // Se la sezione è divisa orizzontalmente, i pannelli sono disposti verticalmente
  const direction = section.direction === 'horizontal' ? 'vertical' : 'horizontal'

  return (
    <ResizablePanelGroup direction={direction} className="h-full">
      {section.children.map((child, index) => (
        <React.Fragment key={child.id}>
          <ResizablePanel defaultSize={100 / section.children!.length} minSize={15}>
            <RecursiveGridSection
              section={child}
              canSplitHorizontal={canSplitHorizontal}
              canSplitVertical={canSplitVertical}
              canRemove={true} // I children possono sempre essere rimossi
            />
          </ResizablePanel>
          {index < section.children!.length - 1 && <ResizableHandle withHandle={showResizeHandle} />}
        </React.Fragment>
      ))}
    </ResizablePanelGroup>
  )
}