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
import { useTranslations } from "next-intl"

interface ChangelogEntry {
  version: string
  date: string
  title: string
  description: string
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

export default function ChangelogPage() {
  const t = useTranslations('changelog');
  const router = useRouter()

  const changelogData: ChangelogEntry[] = [
    {
      version: "1.2.1",
      date: "2025/10/08",
      title: t('version_1_2_1.title'),
      description: t('version_1_2_1.description'),
      tags: ["Refactor", "Bugfix", "Security", "UX"],
      changes: [
        {
          type: "feature",
          items: [
            t('version_1_2_1.changes.feature_1'),
            t('version_1_2_1.changes.feature_2'),
            t('version_1_2_1.changes.feature_3'),
          ]
        },
        {
          type: "bugfix",
          items: [
            t('version_1_2_1.changes.bugfix_1'),
            t('version_1_2_1.changes.bugfix_2'),
            t('version_1_2_1.changes.bugfix_3'),
            t('version_1_2_1.changes.bugfix_4'),
            t('version_1_2_1.changes.bugfix_5'),
            t('version_1_2_1.changes.bugfix_6'),
          ]
        }
      ]
    },
    {
      version: "1.2.0",
      date: "2025/10/03",
      title: t('version_1_2_0.title'),
      description: t('version_1_2_0.description'),
      tags: ["Grid", "Layout", "UX", "Multi-Screen"],
      changes: [
        {
          type: "feature",
          items: [
            t('version_1_2_0.changes.feature_1'),
            t('version_1_2_0.changes.feature_2'),
            t('version_1_2_0.changes.feature_3'),
            t('version_1_2_0.changes.feature_4'),
            t('version_1_2_0.changes.feature_5'),
            t('version_1_2_0.changes.feature_6'),
            t('version_1_2_0.changes.feature_7'),
            t('version_1_2_0.changes.feature_8'),
            t('version_1_2_0.changes.feature_9'),
            t('version_1_2_0.changes.feature_10'),
          ],
          details: t('version_1_2_0.changes.details_1')
        },
        {
          type: "improvement",
          items: [
            t('version_1_2_0.changes.improvement_1'),
            t('version_1_2_0.changes.improvement_2'),
            t('version_1_2_0.changes.improvement_3'),
            t('version_1_2_0.changes.improvement_4'),
          ],
        },
        {
          type: "security",
          items: [
            t('version_1_2_0.changes.security_1'),
            t('version_1_2_0.changes.security_2'),
          ],
        },
      ],
    },
    {
      version: "1.1.0",
      date: "2025/10/02",
      title: t('version_1_1_0.title'),
      description: t('version_1_1_0.description'),
      tags: ["Navigation", "UX", "Performance"],
      changes: [
        {
          type: "feature",
          items: [
            t('version_1_1_0.changes.feature_1'),
            t('version_1_1_0.changes.feature_2'),
            t('version_1_1_0.changes.feature_3'),
            t('version_1_1_0.changes.feature_4'),
          ],
          details: t('version_1_1_0.changes.details_1')
        },
        {
          type: "improvement",
          items: [
            t('version_1_1_0.changes.improvement_1'),
            t('version_1_1_0.changes.improvement_2'),
          ],
        },
        {
          type: "bugfix",
          items: [
            t('version_1_1_0.changes.bugfix_1'),
            t('version_1_1_0.changes.bugfix_2'),
          ],
        },
      ],
    },
    {
      version: "1.0.0",
      date: "2025/10/02",
      title: t('version_1_0_0.title'),
      description: t('version_1_0_0.description'),
      tags: ["Launch", "Architecture", "Security", "UI"],
      changes: [
        {
          type: "feature",
          items: [
            t('version_1_0_0.changes.feature_1'),
            t('version_1_0_0.changes.feature_2'),
            t('version_1_0_0.changes.feature_3'),
            t('version_1_0_0.changes.feature_4'),
            t('version_1_0_0.changes.feature_5'),
            t('version_1_0_0.changes.feature_6'),
            t('version_1_0_0.changes.feature_7'),
            t('version_1_0_0.changes.feature_8'),
            t('version_1_0_0.changes.feature_9'),
            t('version_1_0_0.changes.feature_10'),
            t('version_1_0_0.changes.feature_11'),
            t('version_1_0_0.changes.feature_12'),
            t('version_1_0_0.changes.feature_13'),
            t('version_1_0_0.changes.feature_14'),
            t('version_1_0_0.changes.feature_15'),
            t('version_1_0_0.changes.feature_16'),
            t('version_1_0_0.changes.feature_17'),
          ],
        },
        {
          type: "improvement",
          items: [
            t('version_1_0_0.changes.improvement_1'),
            t('version_1_0_0.changes.improvement_2'),
          ],
        },
        {
          type: "bugfix",
          items: [
            t('version_1_0_0.changes.bugfix_1'),
          ],
        },
      ],
    },
  ]

  const [selectedVersion, setSelectedVersion] = useState<string | null>(changelogData[0]?.version || null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const changeTypeConfig = {
    feature: {
      label: t('change_types.feature'),
      icon: Rocket,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    bugfix: {
      label: t('change_types.bugfix'),
      icon: Bug,
      color: "bg-red-500/10 text-red-500 border-red-500/20",
    },
    improvement: {
      label: t('change_types.improvement'),
      icon: Sparkles,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
    security: {
      label: t('change_types.security'),
      icon: Shield,
      color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    },
  }

  // UPDATED: Use scrollIntoView instead of window.scrollTo because we are scrolling a child container
  const scrollToVersion = (version: string) => {
    const element = document.getElementById(`version-${version}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleVersionSelect = (version: string) => {
    setSelectedVersion(version)
    setIsSheetOpen(false)

    // Delay per permettere al sheet di chiudersi completamente prima dello scroll
    setTimeout(() => {
      scrollToVersion(version)
    }, 300) 
  }

  const handleSidebarVersionSelect = (version: string) => {
    setSelectedVersion(version)
    scrollToVersion(version)
  }

  return (
    // LAYOUT FIX: h-screen + flex-col + overflow-hidden
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
      
      {/* HEADER: flex-shrink-0 per non schiacciarsi */}
      <header className="flex-shrink-0 bg-background/90 backdrop-blur border-b border-border/50 z-20">
        <div className="max-w-7xl mx-auto w-full px-4 py-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('back_button')}
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
            <div className="md:hidden ml-auto">
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
                      {t('select_version')}
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
      </header>

      {/* WRAPPER CONTENUTO: flex-1 + overflow-hidden */}
      <div className="flex-1 flex overflow-hidden relative max-w-7xl mx-auto w-full">
        
        {/* SIDEBAR: overflow-y-auto per scroll indipendente, rimossa 'fixed' */}
        <aside className="hidden md:block w-48 border-r border-border/50 h-full overflow-y-auto p-3 flex-shrink-0">
          <div>
            <h3 className="sticky top-0 bg-background/95 backdrop-blur py-2 font-medium mb-1 text-sm flex items-center gap-2 z-10">
              <Hash className="h-3 w-3" />
              {t('versions_title')}
            </h3>
            <div className="space-y-1 pb-4">
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
          </div>
        </aside>

        {/* MAIN CONTENT: overflow-y-auto per scroll indipendente + padding bottom */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="space-y-4 pb-24 max-w-4xl mx-auto">
            {changelogData.map((entry, index) => (
              <Card
                key={entry.version}
                id={`version-${entry.version}`}
                className="border border-border/40 hover:border-border transition-colors shadow-sm"
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
                          {t('latest_badge')}
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
                    // Fallback to feature if type not found, though types are typed
                    const config = changeTypeConfig[change.type] || changeTypeConfig.feature
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
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
                                <span className="flex-1 text-foreground/90">{item}</span>
                              </li>
                            ))}
                          </ul>
                          
                          {/* Render details if present (from your structure) */}
                          {change.details && (
                             <p className="text-sm text-muted-foreground ml-6 mt-1 italic">
                               {change.details}
                             </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}

            <div className="text-center text-muted-foreground text-sm pt-8">
              <p>End of changelog</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}