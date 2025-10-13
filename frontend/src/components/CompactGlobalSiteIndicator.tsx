"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  Grid3X3,
  Layers,
  MapPin
} from "lucide-react"
import { useTabStore } from "@/store/tabStore"
import { useGridStore } from "@/store/gridStore"
import { useSiteContext } from "@/contexts/SiteContext"

interface CompactGlobalSiteIndicatorProps {
  showSiteName?: boolean
  className?: string
}

export function CompactGlobalSiteIndicator({
  showSiteName = true,
  className = ""
}: CompactGlobalSiteIndicatorProps) {
  const { isTabModeEnabled, tabs } = useTabStore()
  const { isGridModeEnabled } = useGridStore()
  const { selectedSite } = useSiteContext()

  const getModeIcon = () => {
    if (isTabModeEnabled && isGridModeEnabled) {
      return <><Layers className="h-3 w-3" /><Grid3X3 className="h-3 w-3" /></>
    }
    if (isTabModeEnabled) {
      return <Layers className="h-3 w-3" />
    }
    if (isGridModeEnabled) {
      return <Grid3X3 className="h-3 w-3" />
    }
    return null
  }

  const getModeLabel = () => {
    if (isTabModeEnabled && isGridModeEnabled) return "Tab+Grid"
    if (isTabModeEnabled) return "Tabs"
    if (isGridModeEnabled) return "Grid"
    return "Mode"
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="text-xs flex items-center gap-1 cursor-help px-2 py-1"
          >
            {getModeIcon()}
            <span className="hidden sm:inline">{getModeLabel()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {isTabModeEnabled ? `${tabs.length} tabs with` : ""}
            {isTabModeEnabled && isGridModeEnabled ? " " : ""}
            {isGridModeEnabled ? "grid sections have" : ""}
            {" "}independent site selection
          </p>
        </TooltipContent>
      </Tooltip>

      {showSiteName && selectedSite && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[120px]">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-medium">{selectedSite.name}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Global fallback site: {selectedSite.name}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}