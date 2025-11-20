"use client"
import React from 'react'
import { Layers, SquareChartGantt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useTranslations } from 'next-intl'

export function TabModeToggle() {
  const { isTabModeEnabled, toggleTabMode } = useTabStore()

  const t = useTranslations('components.header_buttons');

  const handleToggle = () => {
    toggleTabMode()
  }

  const tooltipMessage = (isTabModeEnabled ? t('disable_tab_mode') : t('enable_tab_mode'));

  const button =  (
    <Button
      variant={isTabModeEnabled ? "default" : "outline"}
      size="icon"
      onClick={handleToggle}
      className={isTabModeEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
    >
      {isTabModeEnabled ? (
        <Layers className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <SquareChartGantt className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle tab mode</span>
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