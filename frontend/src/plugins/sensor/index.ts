// src/plugins/mio-plugin/index.ts
import { Plugin } from '../types'
import { Hammer } from 'lucide-react'


export const sensorPlugin: Plugin = {
  metadata: {
    id: 'sensor',
    name: 'sensor',
    version: '1.0.0',
    description: 'Main sensor with user welcome and overview cards',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/sensor-configuration',
      component: () => import('./SensorPage'),
      title: 'sensor'
    }
  ],
  navItems: [
    {
      title: 'sensor',
      url: '/sensor-configuration',
      icon: Hammer,
      description: 'Main sensor overview'
    }
  ],
  permissions: {
    role: 'guest' // Available to all users
  },
  enabled: true
}