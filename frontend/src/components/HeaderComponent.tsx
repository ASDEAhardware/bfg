"use client"
import React from "react"
import { TabModeToggle } from "@/components/TabModeToggle"
import { GridModeToggle } from "@/components/GridModeToggle"
import { SiteSelector } from "@/components/SiteSelector"
import { GlobalSiteIndicator } from "@/components/GlobalSiteIndicator"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTabStore } from "@/store/tabStore"
import { useGridStore } from "@/store/gridStore"

export function HeaderComponent() {
    const { isTabModeEnabled } = useTabStore()
    const { isGridModeEnabled } = useGridStore()

    // Nascondi il SiteSelector globale quando le modalità tab o grid sono attive
    const shouldShowGlobalSiteSelector = !isTabModeEnabled && !isGridModeEnabled

    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b sticky top-0 z-10 bg-sidebar">
            <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />

                {shouldShowGlobalSiteSelector ? (
                    <SiteSelector />
                ) : (
                    <GlobalSiteIndicator />
                )}
            </div>
            <div className="ml-auto flex items-end gap-2 pr-4">
                <GridModeToggle />
                <TabModeToggle />
                {/* <ThemeSwitch /> */}
            </div>
        </header>
    )
}