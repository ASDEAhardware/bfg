"use client"
import { useEffect } from 'react'
import { GridLayout } from '@/components/GridLayout'
import { useGridStore } from '@/store/gridStore'

export default function GridPage() {
  const { isGridModeEnabled, toggleGridMode } = useGridStore()

  // Ensure grid mode is enabled when visiting the grid page
  useEffect(() => {
    if (!isGridModeEnabled) {
      toggleGridMode()
    }
  }, [isGridModeEnabled, toggleGridMode])

  return <GridLayout />
}