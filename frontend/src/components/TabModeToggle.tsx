"use client"
import React, { useState } from 'react'
import { Layers, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function TabModeToggle() {
  const { isTabModeEnabled, toggleTabMode, tabs } = useTabStore()
  const [showDialog, setShowDialog] = useState(false)

  const handleToggle = () => {
    if (isTabModeEnabled && tabs.length > 0) {
      setShowDialog(true)
    } else {
      toggleTabMode()
    }
  }

  const confirmToggle = () => {
    toggleTabMode()
    setShowDialog(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggle}
        title={isTabModeEnabled ? "Disabilita modalità schede" : "Abilita modalità schede"}
      >
        {isTabModeEnabled ? (
          <Layers className="h-[1.2rem] w-[1.2rem]" />
        ) : (
          <Square className="h-[1.2rem] w-[1.2rem]" />
        )}
        <span className="sr-only">Toggle tab mode</span>
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare modalità schede?</AlertDialogTitle>
            <AlertDialogDescription>
              Hai {tabs.length} schede aperte. Disattivando la modalità schede, tutte le schede verranno chiuse e i dati andranno persi.
              <br /><br />
              Sei sicuro di voler procedere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sì, disattiva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}