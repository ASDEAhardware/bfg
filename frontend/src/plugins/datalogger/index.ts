import { Plugin } from '../types'
import { Videotape } from 'lucide-react'

export const dataloggerPlugin: Plugin = {
  metadata: {
    id: 'datalogger',
    name: 'Data Logger',
    version: '1.0.0',
    description: 'Real-time data logging and monitoring system',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/datalogger',
      component: () => import('./DataLoggerPage'),
      title: 'Data Logger'
    }
  ],
  navItems: [
    {
      title: 'Data Logger',
      url: '/datalogger',
      icon: Videotape,
      description: 'Monitor and log system events'
    }
  ],
  permissions: {
    role: 'staff' // Requires staff privileges
  },
  enabled: true,
  initialize: () => {
    console.log('Data Logger plugin initialized')
  },
  cleanup: () => {
    console.log('Data Logger plugin cleanup')
  }
}