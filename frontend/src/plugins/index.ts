// Plugin registry initialization
import { pluginRegistry } from './registry'
import { dashboardPlugin } from './dashboard'
import { dataloggerPlugin } from './datalogger'
import { mqttDataloggerPlugin } from './mqtt-datalogger'

// Register all plugins
export function initializePlugins() {
  // Register core plugins
  pluginRegistry.register(dashboardPlugin)
  pluginRegistry.register(dataloggerPlugin)
  pluginRegistry.register(mqttDataloggerPlugin)

  console.log('All plugins initialized successfully')
}

// Export the registry for use in components
export { pluginRegistry, getUserPermissions } from './registry'
export type { Plugin, PluginNavItem, PluginRoute, PluginPermission } from './types'