"use client"
import { type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { Link } from "@/components/ui/link"
import { Plus, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTabStore } from "@/store/tabStore"
import { useGridStore } from "@/store/gridStore"
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
  onItemClick,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
  label?: string
  onItemClick?: (path: string) => void
}) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { isTabModeEnabled, openTab } = useTabStore()
  const { isGridModeEnabled } = useGridStore()

  const handleTabOpen = (e: React.MouseEvent, item: { title: string, url: string }) => {
    e.preventDefault()
    e.stopPropagation()
    openTab(item.url, item.title)
  }

  const handleDragStart = (e: React.DragEvent, item: { title: string, url: string }) => {
    // Usa un formato specifico per i menu items
    const menuItemId = `menu-item::${item.url}::${item.title}`
    e.dataTransfer.setData('text/plain', menuItemId)
    e.dataTransfer.effectAllowed = 'copy'
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
                {/* Icona drag per modalità griglia */}
                {isGridModeEnabled && state === "expanded" && (
                  <div
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="h-6 w-6 ml-1 mr-1 transition-all rounded-sm bg-transparent hover:bg-primary/10 border border-transparent hover:border-primary/20 opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0 flex items-center justify-center"
                    title={`Trascina ${item.title} nella griglia`}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-3 w-3" />
                  </div>
                )}

                <a
                  href={item.url}
                  title={item.title}
                  onClick={(e) => { e.preventDefault(); onItemClick?.(item.url); }}
                  className="flex items-center gap-1 flex-1"
                >
                  <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                    {item.icon && <item.icon className="shrink-0 size-4" />}
                    {state === "expanded" && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </a>

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

