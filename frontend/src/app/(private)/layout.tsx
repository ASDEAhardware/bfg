import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/theme-switch"
import { TabModeToggle } from "@/components/TabModeToggle"
import { GridModeToggle } from "@/components/GridModeToggle"
import { TabContent } from "@/components/TabContent"
import { TabNavigationHandler } from "@/components/TabNavigationHandler"
import TabAwareBreadcrumb from "@/components/TabAwareBreadcrumb"
import { ConditionalTabBar } from "@/components/ConditionalTabBar"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import AppFooter from "@/components/app-footer"



export default async function Layout({
    children, // <-- Qui accetti la prop children
}: {
    children: React.ReactNode;
}) {


    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <TabNavigationHandler />
                <header className="flex h-12 shrink-0 items-center gap-2 border-b sticky top-0 z-10 bg-sidebar">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <TabAwareBreadcrumb />
                    </div>
                    <div className="ml-auto flex items-end gap-2 pr-4">
                        <TabModeToggle />
                        <GridModeToggle />
                        <ModeToggle />
                    </div>
                </header>
                <ConditionalTabBar />
                <TabContent>
                    <main className="flex flex-1 flex-col p-4 lg:p-6">{children}</main>
                </TabContent>
                <AppFooter />
            </SidebarInset>
        </SidebarProvider>
    )
}
