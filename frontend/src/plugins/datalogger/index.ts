import { Plugin } from '../types'
import { Videotape } from 'lucide-react'

export const dataloggerPlugin: Plugin = {
  metadata: {
    id: 'datalogger',
    name: 'Datalogger',
    version: '1.0.0',
    description: 'Real-time data logging and monitoring system',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/datalogger',
      component: () => import('./DataLoggerListPage'),
      title: 'Datalogger'
    }
  ],
  navItems: [
    {
      title: 'Datalogger',
      url: '/datalogger',
      icon: Videotape,
      description: 'Monitor and log system events'
    }
  ],
  permissions: {
    role: 'guest' // Requires guest privileges
  },
  enabled: true,
  initialize: () => {
    console.log('Data Logger plugin initialized')
  },
  cleanup: () => {
    console.log('Data Logger plugin cleanup')
  }
}