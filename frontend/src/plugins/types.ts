import { LucideIcon } from "lucide-react"
import { ComponentType } from "react"

export interface PluginRoute {
  path: string
  component: () => Promise<{ default: ComponentType<any> }>
  title: string
  exact?: boolean
}

export interface PluginNavItem {
  title: string
  url: string
  icon?: LucideIcon
  description?: string
}

export interface PluginPermission {
  role: 'guest' | 'staff' | 'superuser'
  custom?: string[]
}

export interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
}

export interface Plugin {
  metadata: PluginMetadata
  routes: PluginRoute[]
  navItems: PluginNavItem[]
  permissions?: PluginPermission
  dependencies?: string[]
  enabled: boolean
  initialize?: () => void | Promise<void>
  cleanup?: () => void | Promise<void>
}

export interface PluginRegistry {
  plugins: Map<string, Plugin>
  register: (plugin: Plugin) => void
  unregister: (pluginId: string) => void
  getPlugin: (pluginId: string) => Plugin | undefined
  getEnabledPlugins: () => Plugin[]
  getPluginsByPermission: (userPermissions: PluginPermission) => Plugin[]
}