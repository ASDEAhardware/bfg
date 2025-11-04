/**
 * Modern MQTT hooks with best practices
 * Replaces the old useMqttStatus.ts with clean, type-safe implementation
 */
import { useState, useEffect, useCallback } from 'react';
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
  const [connection, setConnection] = useState<MqttConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!siteId) {
      setConnection(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`v1/mqtt/sites/${siteId}/status/`);
      setConnection(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch MQTT status';
      setError(errorMessage);
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const refresh = useCallback(() => {
    return fetchStatus();
  }, [fetchStatus]);

  // Helper computed values
  const isHeartbeatTimeout = connection && connection.last_heartbeat_at
    ? Date.now() - new Date(connection.last_heartbeat_at).getTime() > 15000 // 15 seconds timeout
    : false;

  return {
    connection,
    loading,
    error,
    isHeartbeatTimeout,
    refresh
  };
}

// MQTT Control Hook
export function useMqttControl() {
  const [loading, setLoading] = useState(false);

  const controlConnection = useCallback(async (siteId: number, action: 'start' | 'stop'): Promise<MqttControlResponse> => {
    setLoading(true);

    try {
      const response = await api.post(`v1/mqtt/sites/${siteId}/${action}/`);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || `Failed to ${action} MQTT connection`;
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const startConnection = useCallback((siteId: number) => {
    return controlConnection(siteId, 'start');
  }, [controlConnection]);

  const stopConnection = useCallback((siteId: number) => {
    return controlConnection(siteId, 'stop');
  }, [controlConnection]);

  const forceDiscovery = useCallback(async (siteId: number) => {
    setLoading(true);

    try {
      const response = await api.post(`v1/mqtt/sites/${siteId}/discover/`);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to force discovery';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    controlConnection,
    startConnection,
    stopConnection,
    forceDiscovery,
    loading
  };
}

// Dataloggers Hook
export function useDataloggers(siteId: number | null, onlineOnly: boolean = false) {
  const [dataloggers, setDataloggers] = useState<Datalogger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDataloggers = useCallback(async () => {
    if (!siteId) {
      setDataloggers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        site_id: siteId.toString(),
        ...(onlineOnly && { online_only: 'true' })
      });

      const response = await api.get(`v1/mqtt/dataloggers/?${params}`);
      setDataloggers(response.data.dataloggers || []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch dataloggers';
      setError(errorMessage);
      setDataloggers([]);
    } finally {
      setLoading(false);
    }
  }, [siteId, onlineOnly]);

  useEffect(() => {
    fetchDataloggers();
  }, [fetchDataloggers]);

  const refresh = useCallback(() => {
    return fetchDataloggers();
  }, [fetchDataloggers]);

  const updateDataloggerLabel = useCallback(async (datalogger: Datalogger, newLabel: string) => {
    try {
      const response = await api.patch(`v1/mqtt/dataloggers/${datalogger.id}/update_label/`, {
        label: newLabel
      });

      // Update local state
      setDataloggers(prev => prev.map(d =>
        d.id === datalogger.id ? { ...d, label: newLabel } : d
      ));

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update datalogger label';
      throw new Error(errorMessage);
    }
  }, []);

  return {
    dataloggers,
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

/**
 * Hook combinato per status MQTT e polling automatico
 */
export function useMqttStatusWithPolling(siteId: number | null, pollingInterval: number = 30000) {
  const mqttStatus = useMqttConnectionStatus(siteId);
  const dataloggers = useDataloggers(siteId);

  useEffect(() => {
    if (!siteId) return;

    const interval = setInterval(() => {
      mqttStatus.refresh();
      dataloggers.refresh();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [siteId, pollingInterval, mqttStatus.refresh, dataloggers.refresh]);

  return {
    mqtt: mqttStatus,
    dataloggers
  };
}