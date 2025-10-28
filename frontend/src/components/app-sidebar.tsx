"use client"
import * as React from "react"
import { MonitorCog, Shield } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

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
import { useTabStore } from "@/store/tabStore"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: userData, isLoading, error } = useUserInfo()
  const { state } = useSidebar()
  const errorMessage = typeof error === "string" ? error : error ? String(error) : ""

  const { setActiveTab } = useTabStore()
  const router = useRouter()

  const version = "1.2.1"
  const shortVersion = version.split(".").slice(0, 2).join(".")

  const handleVersionClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setActiveTab(null)
    router.push("/version")
  }

  const handleSettingsClick = () => {
    setActiveTab(null);
    router.push("/settings");
  }

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

  const adminPanelItems = [...staffItems, ...superuserItems]
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 overflow-hidden">
          <Image
            src="/images/logo_test.webp"
            alt="Logo"
            width={34}
            height={34}
            className="rounded-full"
            priority
          />
          <span className="font-semibold whitespace-nowrap group-data-[state=collapsed]:hidden">
            Build Fast GUI
          </span>
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
        <NavUser user={userData} isLoading={isLoading} error={errorMessage} onSettingsClick={handleSettingsClick} />
        <div className="bg-sidebar border-t border-sidebar-border px-2 py-1">
          {state === "collapsed" ? (
            // Collapsed: Versione abbreviata centrata
            <div className="text-[10px] text-sidebar-foreground/50 font-mono tracking-wider text-center w-full">
              <a
                href="/version"
                onClick={handleVersionClick}
                className="hover:text-sidebar-foreground/80 transition-colors cursor-pointer"
              >
                v{shortVersion}
              </a>
            </div>
          ) : (
            // Expanded: Layout completo
            <div className="text-[10px] text-sidebar-foreground/50 font-mono tracking-wider flex justify-between items-center w-full">
              <span>© {new Date().getFullYear()} BFG</span>
              <a
                href="/version"
                onClick={handleVersionClick}
                className="hover:text-sidebar-foreground/80 transition-colors cursor-pointer underline-offset-2 hover:underline"
              >
                v{version}
              </a>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
