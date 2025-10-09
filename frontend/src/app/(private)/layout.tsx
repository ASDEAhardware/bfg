import { AppSidebar } from "@/components/app-sidebar"
import { TabContent } from "@/components/TabContent"
import { TabNavigationHandler } from "@/components/TabNavigationHandler"
import { ConditionalTabBar } from "@/components/ConditionalTabBar"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { StatusBar } from "@/components/StatusBar"
import { HeaderComponent } from "@/components/HeaderComponent"
import { SiteProvider } from "@/contexts/SiteContext"



export default async function Layout({
    children, // <-- Qui accetti la prop children
}: {
    children: React.ReactNode;
}) {


    return (
        <SidebarProvider>
            <SiteProvider>
                <AppSidebar />
                <SidebarInset>
                    <TabNavigationHandler />
                    <HeaderComponent />
                    <ConditionalTabBar />
                    <TabContent>
                        <main className="flex flex-1 flex-col pb-12">{children}</main>
                    </TabContent>
                    <StatusBar />
                </SidebarInset>
            </SiteProvider>
        </SidebarProvider>
    )
}
