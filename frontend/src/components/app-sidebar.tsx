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
import { useGridStore } from "@/store/gridStore"
import { useConfirmationDialogStore } from "@/store/dialogStore"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: userData, isLoading, error } = useUserInfo()
  const { state } = useSidebar()
  const errorMessage = typeof error === "string" ? error : error ? String(error) : ""

  const { isTabModeEnabled, setActiveTab, toggleTabMode } = useTabStore()
  const { isGridModeEnabled, toggleGridMode } = useGridStore()
  const showConfirmationDialog = useConfirmationDialogStore((state) => state.show)
  const router = useRouter()

  const version = "1.2.1"
  const shortVersion = version.split(".").slice(0, 2).join(".")

  const handleStandaloneNav = (path: string) => {
    const isModeActive = isGridModeEnabled || isTabModeEnabled;

    const navigate = () => {
      // If grid mode is active, disable it.
      if (isGridModeEnabled) {
        toggleGridMode();
      }
      // If tab mode is active, disable it.
      if (isTabModeEnabled) {
        toggleTabMode();
      }
      // Always exit tab mode when navigating to a standalone page.
      setActiveTab(null);
      router.push(path);
    };

    if (isModeActive) {
      showConfirmationDialog({
        title: "Exit Current View?",
        description: "Navigating to this page will close your current grid or tab view. Your layout will be saved and restored when you return.",
        onConfirm: navigate,
      });
    } else {
      navigate();
    }
  }

  const handleVersionClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    handleStandaloneNav("/version");
  }

  const handleSettingsClick = () => {
    handleStandaloneNav("/settings");
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
        <NavMain items={pluginNavItems} label="Platform" onItemClick={handleStandaloneNav} />
        {adminPanelItems.length > 0 && (
          <>
            <NavMain items={adminPanelItems} label="Staff Panel" onItemClick={handleStandaloneNav} />
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
