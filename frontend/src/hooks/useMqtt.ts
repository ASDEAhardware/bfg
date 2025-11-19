/**
 * Modern MQTT hooks with best practices
 * Replaces the old useMqttStatus.ts with clean, type-safe implementation
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/axios';

// Types
export interface MqttConnectionStatus {
  connection_id: number;
  site_id: number;
  site_name: string;
  is_enabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'disabled';
  broker_host: string;
  broker_port: number;
  last_connected_at?: string;
  last_heartbeat_at?: string;
  connection_errors: number;
  error_message?: string;
  handler_running: boolean;
  handler_connected: boolean;
  retry_count: number;
  subscribed_topics: number;
}

export interface MqttControlResponse {
  success: boolean;
  message: string;
  connection_id?: number;
}

export interface Datalogger {
  id: number;
  site_id: number;
  site_name: string;
  serial_number: string;
  label: string;
  datalogger_type: string;
  device_id: string;
  is_online: boolean;
  last_seen_at?: string;
  last_heartbeat?: string;
  last_communication?: string;
  firmware_version?: string;
  mqtt_api_version?: string;
  ip_address?: string;
  total_heartbeats: number;
  missed_heartbeats: number;
  uptime_percentage: number;
  sensors_count: number;
  active_sensors_count: number;
  created_at: string;
  updated_at: string;
}

export interface Sensor {
  id: number;
  datalogger_label: string;
  site_name: string;
  serial_number: string;
  label: string;
  sensor_type: string;
  unit_of_measure?: string;
  is_online: boolean;
  last_reading?: string;
  total_messages: number;
  total_readings: number;
  min_value_ever?: number;
  max_value_ever?: number;
  first_seen_at?: string;
  last_seen_at?: string;
  uptime_percentage: number;
  consecutive_misses: number;
  latest_readings: Array<{
    timestamp: string;
    data: Record<string, any>;
  }>;
  current_value?: number;
  created_at: string;
  updated_at: string;
}

// MQTT Connection Status Hook
export function useMqttConnectionStatus(siteId: number | null) {
  const { data: connection, isLoading: loading, error: queryError, refetch: refresh } = useQuery<MqttConnectionStatus, Error>({
    queryKey: ['mqttConnectionStatus', siteId],
    queryFn: async () => {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      const response = await api.get(`v1/mqtt/sites/${siteId}/status/`);
      return response.data;
    },
    enabled: !!siteId, // Abilita la query solo se siteId è presente
    staleTime: 5 * 60 * 1000, // I dati sono considerati 'freschi' per 5 minuti
    refetchOnWindowFocus: false, // Non fare refetch automatico al focus della finestra
    retry: 1, // Riprova una volta in caso di errore
  });

  const error = queryError ? queryError.message : null;

  // Helper computed values
  const isHeartbeatTimeout = connection && connection.last_heartbeat_at
    ? Date.now() - new Date(connection.last_heartbeat_at).getTime() > 15000 // 15 seconds timeout
    : false;

  return {
    connection: connection || null,
    loading,
    error,
    isHeartbeatTimeout,
    refresh
  };
}

// MQTT Control Hook
export function useMqttControl() {
  const queryClient = useQueryClient();

  const mutation = useMutation<MqttControlResponse, Error, { siteId: number; action: 'start' | 'stop' }>({
    mutationFn: ({ siteId, action }) => {
      return api.post(`v1/mqtt/sites/${siteId}/${action}/`);
    },
    onMutate: async ({ siteId, action }) => {
      toast.loading(`${action === 'start' ? 'Starting' : 'Stopping'} MQTT connection...`, { id: 'mqtt-control' });
      await queryClient.cancelQueries({ queryKey: ['mqttConnectionStatus', siteId] });
      const previousStatus = queryClient.getQueryData(['mqttConnectionStatus', siteId]);
      queryClient.setQueryData(['mqttConnectionStatus', siteId], (old: any) => {
        if (!old) return undefined;
        return {
          ...old,
          status: action === 'start' ? 'connecting' : 'disabled',
          is_enabled: action === 'start',
        };
      });
      return { previousStatus, siteId };
    },
    onSuccess: (data, variables) => {
      toast.success(`MQTT Connection ${variables.action === 'start' ? 'Started' : 'Stopped'}`, {
        id: 'mqtt-control',
        description: data.message,
        duration: 4000,
      });
    },
    onError: (err, variables, context) => {
      toast.error(`Failed to ${variables.action} MQTT`, {
        id: 'mqtt-control',
        description: err.message,
        duration: 5000,
      });
      if (context?.previousStatus) {
        queryClient.setQueryData(['mqttConnectionStatus', context.siteId], context.previousStatus);
      }
    },
    onSettled: (data, error, variables) => {
      // No longer invalidating here; the WebSocket message is the source of truth.
    },
  });

  const controlConnection = useCallback((siteId: number, action: 'start' | 'stop') => {
    return mutation.mutate({ siteId, action });
  }, [mutation]);

  const startConnection = useCallback((siteId: number) => {
    controlConnection(siteId, 'start');
  }, [controlConnection]);

  const stopConnection = useCallback((siteId: number) => {
    controlConnection(siteId, 'stop');
  }, [controlConnection]);

  const discoveryMutation = useMutation<MqttControlResponse, Error, { siteId: number }>({
    mutationFn: ({ siteId }) => {
      return api.post(`v1/mqtt/sites/${siteId}/discover/`);
    },
    onMutate: () => {
      toast.loading('Forcing topic discovery refresh...', { id: 'discovery-control' });
    },
    onSuccess: (data: any) => {
      toast.success('Discovery Refresh Complete', {
        id: 'discovery-control',
        description: `${data.success_count} topics processed successfully` +
          (data.error_count > 0 ? `, ${data.error_count} errors` : ''),
      });
    },
    onError: (err) => {
      toast.error('Discovery refresh failed', {
        id: 'discovery-control',
        description: err.message,
      });
    },
    onSettled: (data, error, variables) => {
      // The WebSocket message will trigger the invalidation.
      // Forcing a delayed invalidation as a fallback.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', variables.siteId] });
        queryClient.invalidateQueries({ queryKey: ['dataloggers', variables.siteId] });
      }, 1000);
    }
  });

  const forceDiscovery = useCallback((siteId: number) => {
    return discoveryMutation.mutate({ siteId });
  }, [discoveryMutation]);

  return {
    controlConnection,
    startConnection,
    stopConnection,
    forceDiscovery,
    loading: mutation.isPending || discoveryMutation.isPending,
  };
}

// Dataloggers Hook
export function useDataloggers(siteId: number | null, onlineOnly: boolean = false) {
  const { data: dataloggers, isLoading: loading, error: queryError, refetch: refresh } = useQuery<Datalogger[], Error>({
    queryKey: ['dataloggers', siteId, onlineOnly],
    queryFn: async () => {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      const params = new URLSearchParams({
        site_id: siteId.toString(),
        ...(onlineOnly && { online_only: 'true' })
      });
      const response = await api.get(`v1/mqtt/dataloggers/?${params}`);
      return response.data.dataloggers || [];
    },
    enabled: !!siteId, // Abilita la query solo se siteId è presente
    staleTime: 5 * 60 * 1000, // I dati sono considerati 'freschi' per 5 minuti
    refetchOnWindowFocus: false, // Non fare refetch automatico al focus della finestra
    retry: 1, // Riprova una volta in caso di errore
    select: (data) => data.map(d => ({ ...d, id: d.id.toString() })) // Assicurati che l'ID sia una stringa
  });

  const error = queryError ? queryError.message : null;

  const updateDataloggerLabel = useCallback(async (datalogger: Datalogger, newLabel: string) => {
    try {
      const response = await api.patch(`v1/mqtt/dataloggers/${datalogger.id}/update_label/`, {
        label: newLabel
      });
      // Invalida la query per forzare un refetch e aggiornare la UI
      refresh();
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update datalogger label';
      throw new Error(errorMessage);
    }
  }, [refresh]);

  return {
    dataloggers: dataloggers || [],
    loading,
    error,
    refresh,
    updateDataloggerLabel
  };
}

/**
 * Hook for managing sensors of a specific datalogger
 */
export function useSensors(datalogger: Datalogger | null) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSensors = useCallback(async () => {
    if (!datalogger) {
      setSensors([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`v1/mqtt/sensors/by_datalogger?datalogger_id=${datalogger.id}`);
      setSensors(response.data.sensors || []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch sensors';
      setError(errorMessage);
      setSensors([]);
    } finally {
      setLoading(false);
    }
  }, [datalogger]);

  useEffect(() => {
    fetchSensors();
  }, [fetchSensors]);

  const refresh = useCallback(() => {
    return fetchSensors();
  }, [fetchSensors]);

  const updateSensorLabel = useCallback(async (sensor: Sensor, newLabel: string) => {
    try {
      const response = await api.patch(`v1/mqtt/sensors/${sensor.id}/update_label/`, {
        label: newLabel
      });

      // Update local state
      setSensors(prev => prev.map(s =>
        s.id === sensor.id ? { ...s, label: newLabel } : s
      ));

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update sensor label';
      throw new Error(errorMessage);
    }
  }, []);

  return {
    sensors,
    loading,
    error,
    refresh,
    updateSensorLabel
  };
}
