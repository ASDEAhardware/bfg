import { Plugin } from '../types'
import { LayoutDashboard } from 'lucide-react'

export const dashboardPlugin: Plugin = {
  metadata: {
    id: 'dashboard',
    name: 'Dashboard',
    version: '1.0.0',
    description: 'Main dashboard with user welcome and overview cards',
    author: 'BFG Team'
  },
  routes: [
    {
      path: '/dashboard',
      component: () => import('./DashboardPage'),
      title: 'Dashboard'
    }
  ],
  navItems: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: LayoutDashboard,
      description: 'Main dashboard overview'
    }
  ],
  permissions: {
    role: 'guest' // Available to all users
  },
  enabled: true
}