"use client"
import React from "react"
import { ModeToggle } from "@/components/theme-switch"
import { TabModeToggle } from "@/components/TabModeToggle"
import { GridModeToggle } from "@/components/GridModeToggle"
import TabAwareBreadcrumb from "@/components/TabAwareBreadcrumb"
import { SiteSelector } from "@/components/SiteSelector"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function HeaderComponent() {
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b sticky top-0 z-10 bg-sidebar">
            <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                />
                <TabAwareBreadcrumb />
            </div>
            <div className="flex items-center gap-2">
                <SiteSelector />
            </div>
            <div className="ml-auto flex items-end gap-2 pr-4">
                <TabModeToggle />
                <GridModeToggle />
                <ModeToggle />
            </div>
        </header>
    )
}