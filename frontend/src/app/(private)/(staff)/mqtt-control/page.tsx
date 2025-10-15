"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, RotateCcw, Terminal, Activity } from 'lucide-react'
import { toast } from 'sonner'

interface MqttServiceStatus {
  is_running: boolean
  process_count: number
  uptime?: string
  error?: string
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

export default function MqttControlPage() {
  const [status, setStatus] = useState<MqttServiceStatus | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch MQTT service status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/mqtt/service/status/`)
      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching MQTT status:', error)
      setStatus({ is_running: false, process_count: 0, error: 'Connection error' })
    }
  }

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/mqtt/service/logs/`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  // Service control actions
  const restartService = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/mqtt/service/control/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      })

      if (!response.ok) throw new Error('Failed to restart service')

      const data = await response.json()
      toast.success(data.message || 'Service restart successful')

      // Refresh status after restart
      setTimeout(fetchStatus, 2000)
    } catch (error) {
      console.error('Error restarting service:', error)
      toast.error('Failed to restart service')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchStatus()
    fetchLogs()

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStatus()
        fetchLogs()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = () => {
    if (!status) return 'secondary'
    if (status.error) return 'destructive'
    return status.is_running ? 'default' : 'secondary'
  }

  const getStatusText = () => {
    if (!status) return 'Loading...'
    if (status.error) return 'Error'
    return status.is_running ? 'Running (Auto-started)' : 'Starting...'
  }

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-500'
      case 'warning': return 'text-yellow-500'
      case 'info': return 'text-blue-500'
      case 'debug': return 'text-gray-500'
      default: return 'text-gray-700'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MQTT Service Control</h1>
          <p className="text-muted-foreground">Monitor and control the MQTT daemon service</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStatus()
              fetchLogs()
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Service Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>
            Current status of the MQTT daemon process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant={getStatusColor()}>
                {getStatusText()}
              </Badge>
              {status && status.active_connections !== undefined && (
                <span className="text-sm text-muted-foreground">
                  {status.active_connections}/{status.total_connections} connections active
                </span>
              )}
              {status?.uptime && (
                <span className="text-sm text-muted-foreground">
                  {status.uptime}
                </span>
              )}
            </div>
          </div>

          {status?.error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-destructive text-sm">{status.error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={restartService}
              disabled={loading}
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart Service
            </Button>
            <div className="text-sm text-muted-foreground ml-4 flex items-center">
              ℹ️ Service auto-starts with Django. Use restart to reload connections.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Recent Logs
          </CardTitle>
          <CardDescription>
            Last 100 lines from MQTT service logs (auto-refreshes every 5 seconds)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                No logs available
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-400">[{log.timestamp}]</span>
                  <span className={`ml-2 ${getLogLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="ml-2">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}