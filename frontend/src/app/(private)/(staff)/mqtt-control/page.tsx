"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, RotateCcw, Activity } from 'lucide-react'
import { toast } from 'sonner'

interface MqttServiceStatus {
  is_running: boolean
  process_count: number
  uptime?: string
  error?: string
  active_connections?: number
  total_connections?: number
  service_started?: boolean
}


export default function MqttControlPage() {
  const [status, setStatus] = useState<MqttServiceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Fetch MQTT service status
  const fetchStatus = async () => {
    setFetching(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/mqtt/service/status/`)
      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching MQTT status:', error)
      setStatus({ is_running: false, process_count: 0, error: 'Connection error' })
    } finally {
      setFetching(false)
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

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStatus()
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
            onClick={fetchStatus}
            disabled={fetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
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
              💡 Service auto-starts with Django. Use restart if needed.
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}