"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types for datalogger control
export interface DataloggerSession {
  datalogger_id: number
  session_id: string | null
  status: 'running' | 'stopped' | 'terminated forcibly' | 'no process running' | 'unknown'
  last_command: string | null
  last_command_timestamp: string | null
  tdengine_status: 'connected' | 'failed' | null
  software_version: string | null
  device_info: {
    serial_number?: string
    ip_address?: string
    software_version?: string
  } | null
  connected_devices_count: number | null
  last_heartbeat: string | null
  error_message: string | null
}

export interface DataloggerControlState {
  // Sessions per datalogger
  sessions: Record<number, DataloggerSession>

  // Pending commands tracking
  pendingCommands: Record<number, {
    command: string
    timestamp: string
    timeout: NodeJS.Timeout | null
  }>

  // Actions
  initializeSession: (datalogger_id: number) => void
  updateSessionStatus: (datalogger_id: number, data: Partial<DataloggerSession>) => void
  setSessionFromMqttMessage: (datalogger_id: number, message: any) => void
  setPendingCommand: (datalogger_id: number, command: string) => void
  clearPendingCommand: (datalogger_id: number) => void
  getSession: (datalogger_id: number) => DataloggerSession | null
  isLogging: (datalogger_id: number) => boolean
  hasPendingCommand: (datalogger_id: number) => string | null
  clearSessionData: (datalogger_id: number) => void
}

const createDefaultSession = (datalogger_id: number): DataloggerSession => ({
  datalogger_id,
  session_id: null,
  status: 'unknown',
  last_command: null,
  last_command_timestamp: null,
  tdengine_status: null,
  software_version: null,
  device_info: null,
  connected_devices_count: null,
  last_heartbeat: null,
  error_message: null
})

export const useDataloggerControlStore = create<DataloggerControlState>()(
  persist(
    (set, get) => ({
        sessions: {},
        pendingCommands: {},

        initializeSession: (datalogger_id: number) => {
          const state = get()
          if (!state.sessions[datalogger_id]) {
            set({
              sessions: {
                ...state.sessions,
                [datalogger_id]: createDefaultSession(datalogger_id)
              }
            })
          }
        },

        updateSessionStatus: (datalogger_id: number, data: Partial<DataloggerSession>) => {
          const state = get()
          const existingSession = state.sessions[datalogger_id] || createDefaultSession(datalogger_id)

          set({
            sessions: {
              ...state.sessions,
              [datalogger_id]: {
                ...existingSession,
                ...data,
                last_heartbeat: new Date().toISOString()
              }
            }
          })
        },

        setSessionFromMqttMessage: (datalogger_id: number, message: any) => {
          const state = get()
          const existingSession = state.sessions[datalogger_id] || createDefaultSession(datalogger_id)

          const updates: Partial<DataloggerSession> = {
            last_heartbeat: new Date().toISOString()
          }

          // Parse different message types
          if (message.status) {
            updates.status = message.status
            console.log(`Datalogger ${datalogger_id} status updated to: ${message.status}`)

            // Clear pending command if status changed and it's a definitive state
            if (state.pendingCommands[datalogger_id] &&
                (message.status === 'running' || message.status === 'stopped' || message.status === 'no process running')) {
              get().clearPendingCommand(datalogger_id)
            }
          }

          if (message.session_id) {
            updates.session_id = message.session_id
          }

          if (message.tdengine_db) {
            updates.tdengine_status = message.tdengine_db
          }

          if (message.monstr_datalogger) {
            updates.software_version = message.monstr_datalogger
          }

          if (message.serial_number || message.ip_address || message.software_version) {
            updates.device_info = {
              ...existingSession.device_info,
              ...(message.serial_number && { serial_number: message.serial_number }),
              ...(message.ip_address && { ip_address: message.ip_address }),
              ...(message.software_version && { software_version: message.software_version })
            }
          }

          if (message.number_connected_devices) {
            updates.connected_devices_count = parseInt(message.number_connected_devices, 10)
          }

          get().updateSessionStatus(datalogger_id, updates)
        },

        setPendingCommand: (datalogger_id: number, command: string) => {
          const state = get()

          // Clear existing timeout if present
          if (state.pendingCommands[datalogger_id]?.timeout) {
            clearTimeout(state.pendingCommands[datalogger_id].timeout)
          }

          // Set timeout to clear pending command after 30 seconds
          const timeout = setTimeout(() => {
            get().clearPendingCommand(datalogger_id)
          }, 30000)

          set({
            pendingCommands: {
              ...state.pendingCommands,
              [datalogger_id]: {
                command,
                timestamp: new Date().toISOString(),
                timeout
              }
            }
          })

          // Update session with last command
          get().updateSessionStatus(datalogger_id, {
            last_command: command,
            last_command_timestamp: new Date().toISOString()
          })
        },

        clearPendingCommand: (datalogger_id: number) => {
          const state = get()
          const pending = state.pendingCommands[datalogger_id]

          if (pending?.timeout) {
            clearTimeout(pending.timeout)
          }

          const { [datalogger_id]: removed, ...remainingCommands } = state.pendingCommands
          set({ pendingCommands: remainingCommands })
        },

        getSession: (datalogger_id: number) => {
          return get().sessions[datalogger_id] || null
        },

        isLogging: (datalogger_id: number) => {
          const session = get().sessions[datalogger_id]
          return session?.status === 'running'
        },

        hasPendingCommand: (datalogger_id: number) => {
          return get().pendingCommands[datalogger_id]?.command || null
        },

        clearSessionData: (datalogger_id: number) => {
          const state = get()

          // Clear pending command timeout
          if (state.pendingCommands[datalogger_id]?.timeout) {
            clearTimeout(state.pendingCommands[datalogger_id].timeout)
          }

          const { [datalogger_id]: removedSession, ...remainingSessions } = state.sessions
          const { [datalogger_id]: removedCommand, ...remainingCommands } = state.pendingCommands

          set({
            sessions: remainingSessions,
            pendingCommands: remainingCommands
          })
        }
      }),
    {
      name: 'datalogger-control-storage',
      partialize: (state) => ({
        sessions: state.sessions
        // Non persistiamo pendingCommands perché hanno timeout
      })
    }
  )
)