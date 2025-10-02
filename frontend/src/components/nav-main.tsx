"use client"
import { type LucideIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTabStore } from "@/store/tabStore"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"


export function NavMain({
  items,
  label,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[],
  label?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const { isTabModeEnabled, openTab } = useTabStore()

  const handleTabOpen = (e: React.MouseEvent, item: { title: string, url: string }) => {
    e.preventDefault()
    e.stopPropagation()
    openTab(item.url, item.title)
    router.push(item.url)
  }

  const handleNormalNavigation = (e: React.MouseEvent, item: { title: string, url: string }) => {
    if (isTabModeEnabled) {
      e.preventDefault()
      openTab(item.url, item.title)
      router.push(item.url)
    }
  }

  if (!items.length) return null

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url

          return (
            <SidebarMenuItem key={item.url}>
              <div className="flex items-center w-full group">
                <Link
                  href={item.url}
                  className="flex items-center gap-1 flex-1"
                  onClick={(e) => handleNormalNavigation(e, item)}
                >
                  <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                    {item.icon && <item.icon className="shrink-0 size-4" />}
                    {state === "expanded" && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </Link>
                {isTabModeEnabled && state === "expanded" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 ml-1 transition-all rounded-sm bg-transparent hover:bg-primary/10 border border-transparent hover:border-primary/20 opacity-60 hover:opacity-100"
                    onClick={(e) => handleTabOpen(e, item)}
                    title={`Apri ${item.title} in nuova scheda`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

