import { AppSidebar } from "@/components/app-sidebar"
import { TabContent } from "@/components/TabContent"
import { TabNavigationHandler } from "@/components/TabNavigationHandler"
import { ConditionalTabBar } from "@/components/ConditionalTabBar"
import { RefreshIndicator } from "@/components/RefreshIndicator"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { HeaderComponent } from "@/components/HeaderComponent"
import { SiteProvider } from "@/contexts/SiteContext"
import { StatusBarProvider } from "@/components/ContextualStatusBar"
import { GlobalConfirmationDialog } from "@/components/GlobalConfirmationDialog"
import { WebSocketInitializer } from "@/components/WebSocketInitializer"



export default async function Layout({
    children, // <-- Qui accetti la prop children
}: {
    children: React.ReactNode;
}) {


    return (
        <SidebarProvider>
            <SiteProvider>
                <StatusBarProvider>
                    <GlobalConfirmationDialog />
                    <WebSocketInitializer />
                    <RefreshIndicator />
                    <AppSidebar />
                    <SidebarInset>
                        <TabNavigationHandler />
                        <HeaderComponent />
                        <ConditionalTabBar />
                        <TabContent>
                            <main className="flex flex-1 flex-col">{children}</main>
                        </TabContent>
                    </SidebarInset>
                </StatusBarProvider>
            </SiteProvider>
        </SidebarProvider>
    )
}
