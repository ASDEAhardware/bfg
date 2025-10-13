"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Info,
  Grid3X3,
  Layers,
  MapPin,
  Power
} from "lucide-react"
import { useTabStore } from "@/store/tabStore"
import { useGridStore } from "@/store/gridStore"
import { useSiteContext } from "@/contexts/SiteContext"

export function GlobalSiteIndicator() {
  const { isTabModeEnabled, tabs, toggleTabMode } = useTabStore()
  const { isGridModeEnabled, currentLayout, toggleGridMode } = useGridStore()
  const { selectedSite } = useSiteContext()

  const handleExitModes = () => {
    if (isTabModeEnabled) toggleTabMode()
    if (isGridModeEnabled) toggleGridMode()
  }

  const getModeDescription = () => {
    if (isTabModeEnabled && isGridModeEnabled) {
      return "Tab + Grid Mode Active"
    }
    if (isTabModeEnabled) {
      return "Tab Mode Active"
    }
    if (isGridModeEnabled) {
      return "Grid Mode Active"
    }
    return "Special Mode Active"
  }

  const getModeIcon = () => {
    if (isTabModeEnabled && isGridModeEnabled) {
      return <div className="flex items-center gap-1">
        <Layers className="h-3 w-3" />
        <Grid3X3 className="h-3 w-3" />
      </div>
    }
    if (isTabModeEnabled) {
      return <Layers className="h-3 w-3" />
    }
    if (isGridModeEnabled) {
      return <Grid3X3 className="h-3 w-3" />
    }
    return <Info className="h-3 w-3" />
  }

  const getStatsInfo = () => {
    const stats = []

    if (isTabModeEnabled && tabs.length > 0) {
      stats.push(`${tabs.length} tabs open`)
    }

    if (isGridModeEnabled && currentLayout) {
      const sectionsCount = currentLayout.sections.length
      stats.push(`${sectionsCount} grid sections`)
    }

    // Mostra info fallback globale solo se non siamo in modalità griglia pura
    if (selectedSite && !(isGridModeEnabled && !isTabModeEnabled)) {
      stats.push(`Global fallback: ${selectedSite.name}`)
    }

    if (stats.length === 0) {
      if (isGridModeEnabled && !isTabModeEnabled) {
        return "Site selection per grid section"
      }
      return "Site selection managed per tab/section"
    }

    return stats.join(" • ")
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs flex items-center gap-1 px-2"
          >
            {getModeIcon()}
            <span className="hidden sm:inline">{getModeDescription()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[250px]">
          <DropdownMenuLabel className="text-xs font-normal">
            Mode Information
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-xs text-muted-foreground">
            {getStatsInfo()}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleExitModes} className="text-xs">
            <Power className="h-3 w-3 mr-2" />
            Exit {isTabModeEnabled && isGridModeEnabled ? "Both Modes" :
                  isTabModeEnabled ? "Tab Mode" : "Grid Mode"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mostra indicatore sito solo se:
          - C'è un sito selezionato
          - NON siamo in modalità griglia pura (senza schede)
          In modalità griglia pura ogni sezione ha il suo dropdown, non serve fallback globale */}
      {selectedSite && !(isGridModeEnabled && !isTabModeEnabled) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[150px]">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium truncate">{selectedSite.name}</span>
              <span className="text-muted-foreground/60 hidden md:inline">(fallback)</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              Global fallback site for tabs/sections without specific selection
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}