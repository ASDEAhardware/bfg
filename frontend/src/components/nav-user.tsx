"use client"

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
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
  const { isMobile, state } = useSidebar() // Assicurati che isSidebarCollapsed sia disponibile
  const logout = useLogout()

  // Definisci qui errorMessage
  const errorMessage = error && error !== "undefined" ? error : "";

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full rounded-lg" />
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
    //Funzione che converte l'url del container backend di docker con l'url effettivo del backend per permettere al frontend di recuperare e mostrare le immagini
    if (!url) return undefined;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_CONTAINER_URL;
    const publicUrl = process.env.NEXT_PUBLIC_API_URL;
    if (publicUrl && backendUrl && url.startsWith(backendUrl)) {
      return url.replace(backendUrl, publicUrl);
    }
    return url;
  }

  const userComponent = (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.profile_image ? getProfileImageUrl(user.profile_image) : undefined} alt={user.username} />
                <AvatarFallback className="text-lg">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.username}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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

  // Mostra il tooltip solo se la sidebar è collapsed
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {userComponent}
      </TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
  

  // Altrimenti mostra solo il componente utente senza tooltip
  return userComponent
}