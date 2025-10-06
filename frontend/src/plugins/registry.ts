"use client"

import { Plugin, PluginRegistry, PluginPermission } from './types'

class PluginRegistryImpl implements PluginRegistry {
  public plugins = new Map<string, Plugin>()

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.metadata.id)) {
      console.warn(`Plugin ${plugin.metadata.id} is already registered. Overriding...`)
    }

    this.plugins.set(plugin.metadata.id, plugin)

    // Initialize plugin if it has an initialize method
    if (plugin.initialize) {
      plugin.initialize()
    }

    console.log(`Plugin ${plugin.metadata.name} (${plugin.metadata.id}) registered successfully`)
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      // Cleanup plugin if it has a cleanup method
      if (plugin.cleanup) {
        plugin.cleanup()
      }
      this.plugins.delete(pluginId)
      console.log(`Plugin ${pluginId} unregistered successfully`)
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.enabled)
  }

  getPluginsByPermission(userPermissions: PluginPermission): Plugin[] {
    return this.getEnabledPlugins().filter(plugin => {
      if (!plugin.permissions) return true

      // Check role-based permissions
      const userRole = userPermissions.role
      const requiredRole = plugin.permissions.role

      const roleHierarchy = { 'guest': 0, 'staff': 1, 'superuser': 2 }

      if (roleHierarchy[userRole] >= roleHierarchy[requiredRole]) {
        return true
      }

      // Check custom permissions if any
      if (plugin.permissions.custom && userPermissions.custom) {
        return plugin.permissions.custom.every(perm =>
          userPermissions.custom?.includes(perm)
        )
      }

      return false
    })
  }

  getAllPluginNavItems(userPermissions: PluginPermission) {
    return this.getPluginsByPermission(userPermissions)
      .flatMap(plugin => plugin.navItems)
  }

  getAllPluginRoutes(userPermissions: PluginPermission) {
    return this.getPluginsByPermission(userPermissions)
      .flatMap(plugin => plugin.routes)
  }
}

// Global plugin registry instance
export const pluginRegistry = new PluginRegistryImpl()

// Helper function to determine user permissions from user data
export function getUserPermissions(userData: any): PluginPermission {
  if (userData?.is_superuser) {
    return { role: 'superuser' }
  } else if (userData?.is_staff) {
    return { role: 'staff' }
  } else {
    return { role: 'guest' }
  }
}