"use client"
import React, { useEffect } from 'react'
import { useGridStore } from '@/store/gridStore'
import { RecursiveGridSection } from '@/components/RecursiveGridSection'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

export function GridLayout() {
  const { currentLayout, activeSectionId, initializeGrid } = useGridStore()

  // Auto-initialize grid if it doesn't exist
  useEffect(() => {
    if (!currentLayout) {
      initializeGrid()
    }
  }, [currentLayout, initializeGrid])

  if (!currentLayout) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-lg mb-2">Modalità Griglia</div>
          <div className="text-sm">Inizializzazione in corso...</div>
        </div>
      </div>
    )
  }

  const { sections = [] } = currentLayout

  // Rimuovi limiti per i controlli split
  const canSplitHorizontal = true
  const canSplitVertical = true
  const canRemove = sections.length > 1

  // Usa il nuovo sistema ricorsivo
  if (sections.length === 1) {
    // Caso speciale: una sola sezione principale
    const singleSection = sections[0]
    return (
      <div className="flex-1">
        <RecursiveGridSection
          section={singleSection}
          canSplitHorizontal={canSplitHorizontal}
          canSplitVertical={canSplitVertical}
          canRemove={false} // Non si può rimuovere l'unica sezione
        />
      </div>
    )
  }

  // Caso: più sezioni principali - layout orizzontale
  return (
    <div className="flex-1">
      <ResizablePanelGroup direction="horizontal" className="min-h-0">
        {sections.map((section, index) => (
          <React.Fragment key={section.id}>
            <ResizablePanel defaultSize={100 / sections.length} minSize={15}>
              <RecursiveGridSection
                section={section}
                canSplitHorizontal={canSplitHorizontal}
                canSplitVertical={canSplitVertical}
                canRemove={canRemove}
              />
            </ResizablePanel>
            {index < sections.length - 1 && <ResizableHandle withHandle />}
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  )
}