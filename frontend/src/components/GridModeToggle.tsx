"use client"
import React from 'react'
import { Grid3X3, PanelsTopLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/store/gridStore'

export function GridModeToggle() {
  const { isGridModeEnabled, toggleGridMode } = useGridStore()

  const handleToggle = () => {
    toggleGridMode()
  }

  return (
    <Button
      variant={isGridModeEnabled ? "default" : "outline"}
      size="icon"
      onClick={handleToggle}
      title={isGridModeEnabled ? "Disabilita modalità griglia" : "Abilita modalità griglia"}
      className={isGridModeEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
    >
      {isGridModeEnabled ? (
        <Grid3X3 className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <PanelsTopLeft className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle grid mode</span>
    </Button>
  )
}