/**
 * Hook for controlling device start/stop operations via MQTT
 * Follows project patterns and integrates with existing MQTT system
 */
import { useCallback, useEffect, useState } from 'react'
import { useDeviceControlStore } from '@/store/deviceControlStore'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { Datalogger } from './useMqtt'

interface DeviceControlHookProps {
  datalogger: Datalogger | null
  siteId: number | null
}

export function useDeviceControl({ datalogger, siteId }: DeviceControlHookProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    initializeSession,
    updateSessionStatus,
    setSessionFromMqttMessage,
    setPendingCommand,
    clearPendingCommand,
    getSession,
    isLogging,
    hasPendingCommand,
    clearSessionData
  } = useDeviceControlStore()

  // Initialize session when datalogger changes
  useEffect(() => {
    if (datalogger?.id) {
      initializeSession(datalogger.id)
    }
  }, [datalogger?.id, initializeSession])

  // Check initial status when datalogger becomes available and online
  useEffect(() => {
    if (datalogger?.is_online && sendStatus && !isPublishing) {
      // Send status immediately to get current state
      console.log('Checking initial datalogger status...')
      sendStatus()
    }
  }, [datalogger?.is_online, datalogger?.id]) // Removed sendStatus and isPublishing from deps to avoid loops

  // Cleanup on unmount - removed to prevent infinite loops

  /**
   * Construisce i topic dinamicamente basandosi sui dati del datalogger
   */
  const getTopics = useCallback(() => {
    if (!datalogger || !siteId) return null

    // Costruisce topic seguendo il pattern: site_001/gateway/1/datalogger/monstro/1/input
    const siteCode = `site_${siteId.toString().padStart(3, '0')}`
    const baseTopic = `${siteCode}/gateway/1/datalogger/${datalogger.label}/${datalogger.id}`

    return {
      input: `${baseTopic}/input`,
      output: `${baseTopic}/output`
    }
  }, [datalogger, siteId])

  /**
   * Pubblica un comando MQTT tramite API Django
   */
  const publishCommand = useCallback(async (command: string): Promise<boolean> => {
    if (!datalogger || !siteId || isPublishing) return false

    const topics = getTopics()
    if (!topics) {
      setError('Unable to construct MQTT topics')
      return false
    }

    setIsPublishing(true)
    setError(null)

    try {
      // Set pending command first
      setPendingCommand(datalogger.id, command)

      // Call Django API to publish MQTT message
      const response = await api.post(`v1/mqtt/sites/${siteId}/publish/`, {
        topic: topics.input,
        message: command,
        qos: 1
      })

      if (response.data.success) {
        toast.success(`Comando "${command}" inviato`, {
          description: `Topic: ${topics.input}`
        })

        // MOCK RESPONSE for testing (remove when real MQTT is working)
        if (process.env.NODE_ENV === 'development') {
          setTimeout(() => {
            let mockStatus = 'unknown'
            if (command === 'start') {
              mockStatus = 'running'
            } else if (command === 'stop') {
              mockStatus = 'stopped'
            } else if (command === 'status') {
              // Simulate current status - since you started manually, assume it's running
              mockStatus = 'running'
            }

            console.log(`Mock MQTT response: ${command} -> ${mockStatus}`)
            setSessionFromMqttMessage(datalogger.id, {
              status: mockStatus,
              session_id: 'mock-session-' + Date.now(),
              monstr_datalogger: 'V.5.53.0.DB'
            })
          }, 1000) // 1 second delay to simulate real response
        }

        return true
      } else {
        throw new Error(response.data.message || 'Failed to publish command')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || `Failed to send ${command} command`
      setError(errorMessage)
      clearPendingCommand(datalogger.id)

      toast.error(`Errore invio comando`, {
        description: errorMessage
      })
      return false
    } finally {
      setIsPublishing(false)
    }
  }, [datalogger, siteId, isPublishing, getTopics, setPendingCommand, clearPendingCommand, setSessionFromMqttMessage])

  /**
   * Commands
   */
  const sendStart = useCallback(() => publishCommand('start'), [publishCommand])
  const sendStartDetect = useCallback(() => publishCommand('start --detect'), [publishCommand])
  const sendStop = useCallback(() => publishCommand('stop'), [publishCommand])
  const sendStatus = useCallback(() => publishCommand('status'), [publishCommand])

  /**
   * Sottoscrizione ai topic di output per ricevere le risposte
   */
  useEffect(() => {
    if (!datalogger || !siteId) return

    const topics = getTopics()
    if (!topics) return

    let isSubscribed = true

    const subscribeToOutput = async () => {
      try {
        // Sottoscrivi al topic di output tramite API Django
        const response = await api.post(`v1/mqtt/sites/${siteId}/subscribe/`, {
          topic: topics.output,
          callback_url: `/api/datalogger-control/${datalogger.id}/mqtt-callback/`
        })

        if (!response.data.success) {
          console.warn('Failed to subscribe to output topic:', response.data.message)
        }
      } catch (err) {
        console.error('Error subscribing to output topic:', err)
      }
    }

    subscribeToOutput()

    return () => {
      isSubscribed = false
      // Cleanup subscription if needed
    }
  }, [datalogger, siteId, getTopics])

  /**
   * Polling dello stato ogni 60 secondi quando il datalogger è online
   * ABILITATO CON CONTROLLI per evitare loop
   */
  useEffect(() => {
    if (!datalogger?.is_online || !sendStatus || isPublishing) return

    const interval = setInterval(() => {
      // Solo se non stiamo già pubblicando
      if (!isPublishing) {
        sendStatus()
      }
    }, 60000) // 60 secondi invece di 30 per essere più conservativi

    return () => clearInterval(interval)
  }, [datalogger?.is_online, sendStatus, isPublishing])

  // Get current session data
  const session = datalogger ? getSession(datalogger.id) : null
  const currentIsLogging = datalogger ? isLogging(datalogger.id) : false
  const pendingCommand = datalogger ? hasPendingCommand(datalogger.id) : null

  return {
    // State
    session,
    isLogging: currentIsLogging,
    pendingCommand,
    isPublishing,
    error,

    // Commands
    sendStart,
    sendStartDetect,
    sendStop,
    sendStatus,

    // Topics info (for debugging)
    topics: getTopics(),

    // Manual state updates (for MQTT message handling)
    handleMqttMessage: (message: any) => {
      if (datalogger) {
        setSessionFromMqttMessage(datalogger.id, message)
      }
    },

    // Cleanup
    clearSession: () => {
      if (datalogger) {
        clearSessionData(datalogger.id)
      }
    },
    clearPending: () => {
      if (datalogger) {
        clearPendingCommand(datalogger.id)
      }
    }
  }
}