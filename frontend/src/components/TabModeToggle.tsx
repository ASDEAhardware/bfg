"use client"
import React from 'react'
import { Layers, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'

export function TabModeToggle() {
  const { isTabModeEnabled, toggleTabMode } = useTabStore()

  const handleToggle = () => {
    toggleTabMode()
  }

  return (
    <Button
      variant={isTabModeEnabled ? "default" : "outline"}
      size="icon"
      onClick={handleToggle}
      title={isTabModeEnabled ? "Disabilita modalità schede" : "Abilita modalità schede"}
      className={isTabModeEnabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
    >
      {isTabModeEnabled ? (
        <Layers className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Square className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle tab mode</span>
    </Button>
  )
}