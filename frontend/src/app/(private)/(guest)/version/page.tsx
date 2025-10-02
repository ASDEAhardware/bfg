"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Rocket, Bug, Sparkles, Shield, Zap, CheckCircle2 } from "lucide-react"

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
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-balance">Aggiornamenti</h1>
          </div>
          <p className="text-lg text-muted-foreground text-pretty">
            Scopri tutte le novità, i miglioramenti e le correzioni delle ultime versioni della nostra applicazione.
          </p>
        </div>

        {/* Changelog Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="hidden md:block absolute left-[2.5rem] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-8">
            {changelogData.map((entry, index) => (
              <div key={entry.version} className="relative">
                {/* Timeline dot */}
                <div className="hidden md:flex absolute left-[1.875rem] top-8 w-3 h-3 rounded-full bg-primary border-4 border-background z-10" />

                <Card className="md:ml-20 border border-border">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-base font-semibold px-3 py-1">
                          v{entry.version}
                        </Badge>
                        {index === 0 && (
                          <Badge className="bg-primary text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ultima versione
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{entry.date}</span>
                    </div>
                    <CardTitle className="text-2xl">{entry.title}</CardTitle>
                    <CardDescription className="text-base">{entry.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {entry.changes.map((change, changeIndex) => {
                      const config = changeTypeConfig[change.type]
                      const Icon = config.icon

                      return (
                        <div key={changeIndex}>
                          {changeIndex > 0 && <Separator className="mb-6" />}

                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md border ${config.color}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <h3 className="font-semibold">{config.label}</h3>
                            </div>

                            <ul className="space-y-2 ml-1">
                              {change.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="flex items-start gap-3 text-sm">
                                  <span className="text-muted-foreground mt-1.5">•</span>
                                  <span className="flex-1 leading-relaxed">{item}</span>
                                </li>
                              ))}
                            </ul>
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

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Hai suggerimenti o hai trovato un bug?{" "}
            <a href="#" className="text-primary hover:underline">
              Contattaci
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
