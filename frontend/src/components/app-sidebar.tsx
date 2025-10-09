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
} from "@/components/ui/sidebar"
import { useUserInfo } from "@/hooks/useAuth"
import { pluginRegistry, getUserPermissions } from "@/plugins"

import Image from "next/image"


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: userData, isLoading, error } = useUserInfo()
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
          <span className="font-semibold group-data-[state=collapsed]:hidden">Placeholder</span>
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
      </SidebarFooter>
    </Sidebar>
  )
}
