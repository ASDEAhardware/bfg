"use client"
import React, { useState } from 'react'
import { Plus, LayoutDashboard, Shield, MonitorCog, Layers, SquareChartGantt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabStore } from '@/store/tabStore'
import { useUserInfo } from '@/hooks/useAuth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface PageSelectorProps {
  onPageSelect: (url: string, title: string, existingTabId?: string) => void
}

export function PageSelector({ onPageSelect }: PageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('platform')
  const { tabs } = useTabStore()
  const { data: userData } = useUserInfo()


  // Pagine Platform
  const platformPages = [
    { url: '/dashboard', title: 'Dashboard', icon: LayoutDashboard, description: 'Panoramica principale' }
  ]

  // Pagine Staff Panel (se l'utente è staff o superuser)
  const staffPages: typeof platformPages = []
  if (userData?.is_staff) {
    staffPages.push({ url: '/staff-admin', title: 'Admin Panel', icon: Shield, description: 'Pannello amministrazione' })
  }
  if (userData?.is_superuser) {
    staffPages.push({ url: '/system', title: 'System Config', icon: MonitorCog, description: 'Configurazione sistema' })
  }

  // Schede esistenti (esclusa la griglia)
  const existingTabs = tabs.filter(tab => tab.id !== 'grid-tab')

  const handlePageSelect = (url: string, title: string, existingTabId?: string) => {
    onPageSelect(url, title, existingTabId)
    setOpen(false)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'platform':
        return platformPages.map((page) => (
          <div
            key={page.url}
            className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer text-sm"
            onClick={() => handlePageSelect(page.url, page.title)}
          >
            <page.icon className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{page.title}</div>
              <div className="text-xs text-muted-foreground truncate">{page.description}</div>
            </div>
          </div>
        ))

      case 'staff':
        return staffPages.map((page) => (
          <div
            key={page.url}
            className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer text-sm"
            onClick={() => handlePageSelect(page.url, page.title)}
          >
            <page.icon className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{page.title}</div>
              <div className="text-xs text-muted-foreground truncate">{page.description}</div>
            </div>
          </div>
        ))

      case 'tabs':
        return existingTabs.map((tab) => {
          // Usa direttamente il customTitle che ora è già espanso
          const displayTitle = tab.customTitle || tab.title

          return (
            <div
              key={tab.id}
              className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer text-sm"
              onClick={() => handlePageSelect(tab.url, displayTitle, tab.id)}
            >
              <SquareChartGantt className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{displayTitle}</div>
                <div className="text-xs text-muted-foreground truncate">{tab.url}</div>
              </div>
            </div>
          )
        })

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 px-6 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Aggiungi Pagina
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Seleziona una pagina</DialogTitle>
          <DialogDescription className="text-sm">
            Scegli una pagina da visualizzare in questa sezione.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'platform'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('platform')}
          >
            <LayoutDashboard className="h-4 w-4 inline mr-1" />
            Platform
          </button>

          {staffPages.length > 0 && (
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'staff'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('staff')}
            >
              <Shield className="h-4 w-4 inline mr-1" />
              Staff
            </button>
          )}

          {existingTabs.length > 0 && (
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tabs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('tabs')}
            >
              <Layers className="h-4 w-4 inline mr-1" />
              Schede ({existingTabs.length})
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
          <div className="space-y-1 p-1">
            {renderTabContent()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}