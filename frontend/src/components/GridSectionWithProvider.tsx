"use client"
import React from 'react'
import { GridSection as GridSectionType } from '@/store/gridStore'
import { SectionSiteProvider } from '@/contexts/SectionSiteContext'
import { GridSection } from '@/components/GridSection'

interface GridSectionWithProviderProps {
  section: GridSectionType
  isActive: boolean
  canSplitHorizontal: boolean
  canSplitVertical: boolean
  canRemove: boolean
}

/**
 * Wrapper che fornisce il SectionSiteProvider a ogni sezione grid individuale.
 * Questo è il punto di integrazione tra il sistema di grid esistente
 * e il nuovo sistema di contesto isolato per sezioni.
 */
export function GridSectionWithProvider({
  section,
  isActive,
  canSplitHorizontal,
  canSplitVertical,
  canRemove
}: GridSectionWithProviderProps) {
  return (
    <SectionSiteProvider sectionId={section.id}>
      <GridSection
        section={section}
        isActive={isActive}
        canSplitHorizontal={canSplitHorizontal}
        canSplitVertical={canSplitVertical}
        canRemove={canRemove}
      />
    </SectionSiteProvider>
  )
}