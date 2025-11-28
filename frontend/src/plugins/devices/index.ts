import { Plugin } from '../types'
import { Cpu } from 'lucide-react'

export const devicesPlugin: Plugin = {
  metadata: {
    id: 'devices',
    name: 'Devices',
    version: '1.0.0',
    description: 'Real-time device monitoring and management system',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/devices',
      component: () => import('./DevicesListPage'),
      title: 'Devices'
    }
  ],
  navItems: [
    {
      title: 'Devices',
      url: '/devices',
      icon: Cpu,
      description: 'Monitor and manage devices'
    }
  ],
  permissions: {
    role: 'guest' // Requires guest privileges
  },
  enabled: true
}