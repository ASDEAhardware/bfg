"use client"
import * as React from "react"
import {
  MonitorCog,
  Shield,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { useUserInfo } from "@/hooks/useAuth"
import { pluginRegistry, getUserPermissions } from "@/plugins"

import Image from "next/image"


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: userData, isLoading, error } = useUserInfo()
  const { state } = useSidebar()
  const errorMessage = typeof error === "string" ? error : error ? String(error) : "";

  // Get plugin-based navigation items
  const pluginNavItems = React.useMemo(() => {
    if (!userData) return []

    const userPermissions = getUserPermissions(userData)
    return pluginRegistry.getAllPluginNavItems(userPermissions)
  }, [userData])

  const staffItems = userData?.is_staff
    ? [{ title: "Admin Panel", url: "/staff-admin", icon: Shield }]
    : []

  const superuserItems = userData?.is_superuser
    ? [{ title: "System Config", url: "/system", icon: MonitorCog }]
    : []

  const adminPanelItems = [...staffItems, ...superuserItems];
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image
            src="/images/logo.jpg"
            alt="Logo"
            width={34}
            height={34}
            className="rounded-full"
            priority
          />
          <span className="font-semibold group-data-[state=collapsed]:hidden">Big Features GUI</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={pluginNavItems} label="Platform" />
        {adminPanelItems.length > 0 && (
          <>
            <NavMain items={adminPanelItems} label="Staff Panel" />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} tooltip="Profile" isLoading={isLoading} error={errorMessage} />
        <div className="bg-sidebar border-t border-sidebar-border px-2 py-1">
          {state === "collapsed" ? (
            // Collapsed: Solo versione centrata
            <div className="text-[8px] text-sidebar-foreground/50 font-mono tracking-wider text-center">
              <a href="/version" className="hover:text-sidebar-foreground/80 transition-colors cursor-pointer">v1.2.1</a>
            </div>
          ) : (
            // Expanded: Layout completo
            <div className="text-[10px] text-sidebar-foreground/50 font-mono tracking-wider flex justify-between items-center">
              <span>© {new Date().getFullYear()} BFG</span>
              <a href="/version" className="hover:text-sidebar-foreground/80 transition-colors cursor-pointer underline-offset-2 hover:underline">v1.2.1</a>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
