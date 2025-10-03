"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Rocket, Bug, Sparkles, Shield, Zap, CheckCircle2, ArrowLeft, ExternalLink, Calendar, Package } from "lucide-react"

interface ChangelogEntry {
  version: string
  date: string
  title: string
  description: string
  changes: {
    type: "feature" | "bugfix" | "improvement" | "security"
    items: string[]
  }[] // Significa che changes deve essere un array di oggetti. Ogni oggetto dentro `changes` deve avere un campo type che può essere una sola stringa tra quelle proposte e deve avere un capo items che è un array di stringhe.
}

const changelogData: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "02 Ottobre 2025",
    title: "Tab Navigation",
    description:
      "Aggiunta la navigazione degli elementi della sidebar tramite tabs.",
    changes: [
      {
        type: "feature",
        items: [
          "Aggiunti i componenti per permettere la navigazione con le Tabs.",
          "Aggiunto il css per nascondere la scrollbar senza disabilitare lo scroll.",
          "Aggiunto l'alert dialog che viene mostrato quando si disabilita la modalità tabs senza averle chiuse.",
          "Aggiunto lo store Zustand per le tabs.",
        ],
      },
      {
        type: "improvement",
        items: [
          "Nessun miglioramento al codice esistente rilevante in questa release.",
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
  {
    version: "1.0.0",
    date: "02 Ottobre 2025",
    title: "Release iniziale dell'applicazione web",
    description:
      "Prima versione pubblica: architettura containerizzata, autenticazione sicura, API REST, frontend Next.js con gestione stato avanzata e UI moderna.",
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumb/Navigation */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna indietro
          </Button>
        </div>

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-4">
            Changelog
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Scopri tutte le novità, i miglioramenti e le correzioni delle ultime versioni della nostra applicazione.
          </p>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">{changelogData.length}</div>
              <div className="text-sm text-muted-foreground">Versioni</div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-500">
                {changelogData.reduce((acc, entry) =>
                  acc + entry.changes.find(c => c.type === 'feature')?.items.length || 0, 0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Funzionalità</div>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-500">
                {changelogData.reduce((acc, entry) =>
                  acc + entry.changes.find(c => c.type === 'bugfix')?.items.length || 0, 0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Correzioni</div>
            </div>
          </div>
        </div>

        {/* Changelog Timeline */}
        <div className="relative">
          {/* Timeline line with gradient */}
          <div className="hidden md:block absolute left-[2.5rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary via-border to-transparent" />

          <div className="space-y-12">
            {changelogData.map((entry, index) => (
              <div key={entry.version} className="relative group">
                {/* Enhanced Timeline dot */}
                <div className="hidden md:flex absolute left-[1.5rem] top-8 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 border-4 border-background shadow-lg z-10 items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-background" />
                </div>

                <Card className="md:ml-20 border border-border/60 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-border group-hover:scale-[1.02] bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Badge variant="outline" className="text-lg font-bold px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 w-fit">
                          v{entry.version}
                        </Badge>
                        {index === 0 && (
                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 w-fit">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ultima versione
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{entry.date}</span>
                      </div>
                    </div>
                    <CardTitle className="text-3xl font-bold leading-tight">{entry.title}</CardTitle>
                    <CardDescription className="text-lg leading-relaxed mt-2">{entry.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-8 pt-2">
                    {entry.changes.map((change, changeIndex) => {
                      const config = changeTypeConfig[change.type]
                      const Icon = config.icon

                      return (
                        <div key={changeIndex}>
                          {changeIndex > 0 && <Separator className="mb-8 opacity-50" />}

                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg border backdrop-blur-sm ${config.color}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <h3 className="font-bold text-lg">{config.label}</h3>
                              <Badge variant="secondary" className="ml-auto">
                                {change.items.length}
                              </Badge>
                            </div>

                            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                              <ul className="space-y-3">
                                {change.items.map((item, itemIndex) => (
                                  <li key={itemIndex} className="flex items-start gap-4 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                                    <span className="flex-1 leading-relaxed">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-muted/50 via-muted/80 to-muted/50 rounded-xl border border-border/50 p-8 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Resta aggiornato</h3>
            </div>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Hai suggerimenti o hai trovato un bug? Il tuo feedback ci aiuta a migliorare continuamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" className="group">
                <ExternalLink className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                Contattaci
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                <Zap className="h-4 w-4 mr-2" />
                Aggiorna pagina
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
