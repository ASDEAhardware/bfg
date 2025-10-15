import { Plugin } from '../types'
import { Radio } from 'lucide-react'

export const mqttDataloggerPlugin: Plugin = {
  metadata: {
    id: 'mqtt-datalogger',
    name: 'MQTT Datalogger',
    version: '1.0.0',
    description: 'Real-time MQTT sensor monitoring and data logging',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/mqtt-datalogger',
      component: () => import('./MqttDataLoggerPage'),
      title: 'MQTT Datalogger'
    }
  ],
  navItems: [
    {
      title: 'MQTT Datalogger',
      url: '/mqtt-datalogger',
      icon: Radio,
      description: 'Monitor real-time MQTT sensor data'
    }
  ],
  permissions: {
    role: 'staff' // Requires staff privileges
  },
  enabled: true,
  initialize: () => {
    console.log('MQTT Data Logger plugin initialized')
  },
  cleanup: () => {
    console.log('MQTT Data Logger plugin cleanup')
  }
}