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
                <HeaderComponent />
                <ConditionalTabBar />
                <TabContent>
                    <main className="flex flex-1 flex-col p-4 lg:p-6 pb-12">{children}</main>
                </TabContent>
                <StatusBar />
            </SidebarInset>
        </SidebarProvider>
    )
}
