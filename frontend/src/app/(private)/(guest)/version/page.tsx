"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Rocket, Bug, Sparkles, Shield, CheckCircle2, ArrowLeft, Star, Hash, ChevronDown } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface ChangelogEntry {
  version: string
  date: string
  title: string
  description: string
  highlights?: string[]
  tags?: string[]
  videoUrl?: string
  docsUrl?: string
  downloadUrl?: string
  isBreaking?: boolean
  changes: {
    type: "feature" | "bugfix" | "improvement" | "security"
    items: string[]
    details?: string
  }[]
}

const changelogData: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "03 Ottobre 2025",
    title: "Grid System",
    description: "Implementazione completa del sistema di griglia per visualizzazione multi-schermo e gestione layout avanzata.",
    highlights: [
      "Sistema di griglia multi-sezione completamente funzionale",
      "Gestione layout dinamica con divisione orizzontale/verticale",
      "Integrazione avanzata con sistema tabs esistente",
      "Persistenza stato e navigazione intelligente"
    ],
    tags: ["Grid", "Layout", "UX", "Multi-Screen"],
    videoUrl: "#demo-grid",
    docsUrl: "#docs-grid",
    changes: [
      {
        type: "feature",
        items: [
          "Implementazione GridStore con Zustand per gestione stato griglia completa",
          "GridSection component per rendering e gestione sezioni individuali",
          "Sistema di divisione dinamica orizzontale/verticale delle sezioni",
          "Supporto completo per assegnazione tabs alle sezioni grid",
          "Virtual Pages system per contenuti dinamici nelle sezioni",
          "Drag & Drop per trascinamento schede nelle sezioni",
          "GridModeToggle component per controllo modalità griglia",
          "PageSelector per assegnazione pagine specifiche alle sezioni",
          "TabContentRenderer specializzato per contenuti tab in grid",
          "Smart Navigation integration con grid mode attivo"
        ],
        details: "Il grid system rappresenta un salto qualitativo nell'esperienza utente, permettendo visualizzazione contemporanea di contenuti multipli con gestione layout professionale."
      },
      {
        type: "improvement",
        items: [
          "Layout responsive che si adatta automaticamente alle dimensioni schermo",
          "Algoritmi ottimizzati per posizionamento e ridimensionamento sezioni",
          "Persistenza automatica stato griglia tra sessioni utente",
          "Performance ottimizzate per rendering di layout complessi"
        ],
      },
      {
        type: "security",
        items: [
          "Validazione robusta degli stati grid per prevenire corruzioni layout",
          "Gestione sicura della memoria per layout complessi"
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "02 Ottobre 2025",
    title: "Tab Navigation",
    description: "Aggiunta la navigazione degli elementi della sidebar tramite tabs.",
    highlights: [
      "Sistema di navigazione a schede completamente nuovo",
      "Gestione stato avanzata con Zustand",
      "UI responsiva con supporto drag & drop"
    ],
    tags: ["Navigation", "UX", "Performance"],
    videoUrl: "#demo-tabs",
    docsUrl: "#docs-tabs",
    changes: [
      {
        type: "feature",
        items: [
          "Aggiunti i componenti per permettere la navigazione con le Tabs.",
          "Aggiunto il css per nascondere la scrollbar senza disabilitare lo scroll.",
          "Aggiunto l'alert dialog che viene mostrato quando si disabilita la modalità tabs senza averle chiuse.",
          "Aggiunto lo store Zustand per le tabs.",
        ],
        details: "Il sistema di tab navigation migliora significativamente l'esperienza utente permettendo multitasking efficiente."
      },
      {
        type: "improvement",
        items: [
          "Ottimizzazioni performance per rendering delle schede",
          "Migliorata accessibilità con supporto keyboard navigation"
        ],
      },
      {
        type: "bugfix",
        items: [
          "Risolti problemi di memory leak nella gestione delle schede",
          "Fixato problema di sincronizzazione stato tra componenti"
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "02 Ottobre 2025",
    title: "Release iniziale dell'applicazione web",
    description: "Prima versione pubblica: architettura containerizzata, autenticazione sicura, API REST, frontend Next.js con gestione stato avanzata e UI moderna.",
    highlights: [
      "Architettura completamente containerizzata",
      "Autenticazione JWT sicura e scalabile",
      "Frontend moderno con Next.js e TypeScript",
      "UI system basato su Shadcn/UI"
    ],
    tags: ["Launch", "Architecture", "Security", "UI"],
    docsUrl: "#docs-v1",
    downloadUrl: "#download-v1",
    changes: [
      {
        type: "feature",
        items: [
          "Setup completamente containerizzato con Docker e Docker Compose per backend e frontend.",
          "Server Next.js come Backend for Frontend (BFF) con rendering SSR, protezione API route e validazione JWT.",
          "Comunicazione sicura tra container frontend e backend tramite rete Docker.",
          "Backend sviluppato con Django e Django REST Framework.",
          "Autenticazione JWT tramite dj-rest-auth e djangorestframework-simplejwt.",
          "Strategia di validazione asimmetrica dei JWT: firma con chiave privata, endpoint pubblico per chiave pubblica.",
          "Memorizzazione sicura dei token JWT in cookie (refresh_token httpOnly, access_token standard).",
          "Endpoint API per registrazione, login, logout, reset password e recupero dati utente.",
          "Frontend Next.js (App Router), React e TypeScript.",
          "Gestione stato globale con Zustand.",
          "Data fetching e caching con TanStack Query (React Query).",
          "API client Axios verso il BFF.",
          "UI con Radix UI, Shadcn UI e Tailwind CSS.",
          "Supporto tema light/dark con next-themes.",
          "Routing protetto basato su ruoli tramite directory e middleware Next.js.",
          "Middleware Next.js per protezione delle route private.",
          "Validazione JWT lato server nel BFF tramite jose.",
        ],
      },
      {
        type: "improvement",
        items: [
          "ESLint configurato per mantenere elevati standard di codice frontend.",
          "File di esempio per variabili d'ambiente (example.env, example.env.local) per backend e frontend.",
        ],
      },
      {
        type: "bugfix",
        items: [
          "Nessuna correzione bug rilevante in questa release iniziale.",
        ],
      },
    ],
  },
]

const changeTypeConfig = {
  feature: {
    label: "Nuove funzionalità",
    icon: Rocket,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  bugfix: {
    label: "Correzioni",
    icon: Bug,
    color: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  improvement: {
    label: "Miglioramenti",
    icon: Sparkles,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  security: {
    label: "Sicurezza",
    icon: Shield,
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
}

export default function ChangelogPage() {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(changelogData[0]?.version || null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const router = useRouter()

  const scrollToVersion = (version: string) => {
    const element = document.getElementById(`version-${version}`)
    if (element) {
      // Calcola offset per header sticky
      const headerHeight = 60 // Altezza approssimativa del header
      const elementPosition = element.offsetTop - headerHeight

      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      })
    }
  }

  const handleVersionSelect = (version: string) => {
    setSelectedVersion(version)
    setIsSheetOpen(false)

    // Delay per permettere al sheet di chiudersi completamente prima dello scroll
    setTimeout(() => {
      scrollToVersion(version)
    }, 300) // Tempo per animazione chiusura sheet
  }

  const handleSidebarVersionSelect = (version: string) => {
    setSelectedVersion(version)
    scrollToVersion(version)
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header compatto */}
        <div className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border/50">
          <div className="px-4 py-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Indietro
              </Button>
              <h1 className="text-xl font-bold">Changelog</h1>

              {/* Badge versione - solo desktop */}
              <div className="hidden md:block">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  v{changelogData[0]?.version}
                </Badge>
              </div>

              {/* Mobile Sheet per selezione versione */}
              <div className="md:hidden">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-green-500/10 text-green-600 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      v{selectedVersion}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Seleziona Versione
                      </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-full mt-6">
                      <div className="space-y-2 pb-6">
                        {changelogData.map((entry) => (
                          <button
                            key={entry.version}
                            onClick={() => handleVersionSelect(entry.version)}
                            className={`w-full text-left p-4 rounded-lg border transition-all ${
                              selectedVersion === entry.version
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'border-border/50 hover:border-border hover:bg-accent'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-lg">v{entry.version}</span>
                              {entry.version === changelogData[0]?.version && (
                                <Star className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mb-1">{entry.date}</div>
                            <div className="text-sm font-medium line-clamp-2">{entry.title}</div>

                            {entry.tags && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entry.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar navigazione veloce */}
          <div className="hidden md:block w-48 p-3 border-r border-border/50">
            <div className="sticky top-20">
              <h3 className="font-medium mb-3 text-sm flex items-center gap-2">
                <Hash className="h-3 w-3" />
                Versioni
              </h3>
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="space-y-1">
                  {changelogData.map((entry) => (
                    <button
                      key={entry.version}
                      onClick={() => handleSidebarVersionSelect(entry.version)}
                      className={`w-full text-left p-2 rounded border transition-all hover:bg-accent text-sm ${
                        selectedVersion === entry.version
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">v{entry.version}</span>
                        {entry.version === changelogData[0]?.version && (
                          <Star className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{entry.date}</div>
                      <div className="text-xs font-medium text-foreground/80 line-clamp-1">{entry.title}</div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Contenuto principale */}
          <div className="flex-1 p-4">

            {/* Timeline compatto */}
            <div className="space-y-4">
              {changelogData.map((entry, index) => (
                <Card
                  key={entry.version}
                  id={`version-${entry.version}`}
                  className="border border-border/40 hover:border-border transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-semibold px-2 py-1">
                          v{entry.version}
                        </Badge>
                        {index === 0 && (
                          <Badge className="bg-green-500 text-white px-2 py-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Latest
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{entry.date}</span>
                    </div>
                    <CardTitle className="text-xl leading-tight">{entry.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">{entry.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    {entry.changes.map((change, changeIndex) => {
                      const config = changeTypeConfig[change.type]
                      const Icon = config.icon

                      return (
                        <div key={changeIndex}>
                          {changeIndex > 0 && <Separator className="my-3" />}

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${config.color}`}>
                                <Icon className="h-3 w-3" />
                              </div>
                              <span className="font-medium text-sm">{config.label}</span>
                              <Badge variant="secondary" className="text-xs">
                                {change.items.length}
                              </Badge>
                            </div>

                            <ul className="space-y-1 ml-6">
                              {change.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="flex items-start gap-2 text-sm">
                                  <div className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                                  <span className="flex-1">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
