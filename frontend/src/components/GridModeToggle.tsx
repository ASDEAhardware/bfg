"use client"
import React from 'react'
import { Grid3X3, PanelsTopLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGridStore } from '@/store/gridStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function GridModeToggle() {
  const { isGridModeEnabled, toggleGridMode } = useGridStore()

  const tooltipMessage = (isGridModeEnabled ? "Disable Grid Mode" : "Enable Grid Mode");

  const button = (
    <Button
      variant={isGridModeEnabled ? "default" : "outline"}
      size="icon"
      onClick={toggleGridMode}
      className={isGridModeEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
      title={isGridModeEnabled ? "Disable Grid Mode" : "Enable Grid Mode"}
    >
      {isGridModeEnabled ? (
        <Grid3X3 className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <PanelsTopLeft className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle grid mode</span>
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        {tooltipMessage}
      </TooltipContent>
    </Tooltip>
  )
}