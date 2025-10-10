"use client"

import {
  LogOut,
  Settings2,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "./ui/skeleton"
import { useLogout } from "@/hooks/useAuth"
import { Link } from "@/components/ui/link"
import { User } from "@/types/user"
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function NavUser({
  user,
  isLoading,
  error,
  tooltip
}: {
  user?: User,
  isLoading?: boolean,
  error?: string,
  tooltip?: string
}) {
  const { isMobile, state } = useSidebar()
  const logout = useLogout()
  const isCollapsed = state === "collapsed"

  const errorMessage = error && error !== "undefined" ? error : "";

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full rounded-none" />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (errorMessage && errorMessage !== "undefined") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="text-red-500 text-sm">{errorMessage}</div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user) {
    return null
  }

  const getProfileImageUrl = (url: string) => {
    if (!url) return undefined;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_CONTAINER_URL;
    const publicUrl = process.env.NEXT_PUBLIC_API_URL;
    if (publicUrl && backendUrl && url.startsWith(backendUrl)) {
      return url.replace(backendUrl, publicUrl);
    }
    return url;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`
              flex items-center w-full h-12 px-2 rounded-none border-0 bg-transparent
              hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
              focus:outline-none focus:bg-sidebar-accent focus:text-sidebar-accent-foreground
              transition-colors cursor-pointer
              ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-2'}
            `}>
              <Avatar className="h-8 w-8 rounded-lg flex-shrink-0">
                <AvatarImage src={user.profile_image ? getProfileImageUrl(user.profile_image) : undefined} alt={user.username} />
                <AvatarFallback className="text-lg">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>

              {!isCollapsed && (
                <>
                  <div className="flex-1 text-left text-sm leading-tight min-w-0">
                    <div className="truncate font-medium">{user.username}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="w-4 h-4 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.profile_image ? getProfileImageUrl(user.profile_image) : undefined} alt={user.username} />
                  <AvatarFallback className="text-lg">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.username}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Link href={"/settings/"}>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings2 />
                  Settings
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => logout.mutate()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}