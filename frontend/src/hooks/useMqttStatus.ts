"use client";

import { useState, useEffect, useCallback } from 'react';

export interface MqttSensorData {
  device_name: string;
  is_online: boolean;
  last_seen_at: string | null;
  total_messages: number;
  consecutive_misses: number;
  timestamp?: string;
  acc_x?: number;
  acc_y?: number;
  acc_z?: number;
  incli_x?: number;
  incli_y?: number;
  mag_x?: number;
  mag_y?: number;
  mag_z?: number;
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;
}

export interface MqttConnectionStatus {
  id: number;
  site__name: string;
  site__code: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  last_connected_at: string | null;
  last_heartbeat_at: string | null;
  connection_errors: number;
  error_message: string;
}

export interface MqttStatusData {
  connections: MqttConnectionStatus[];
  sensor_stats: Record<string, {
    total_sensors: number;
    online_sensors: number;
    offline_sensors: number;
    active_sensors: number;
    total_messages: number;
  }>;
  timestamp: string;
}

export interface MqttSensorResponse {
  sensors: MqttSensorData[];
  timestamp: string;
}

/**
 * Hook for real-time MQTT status monitoring
 */
export function useMqttStatus(refreshInterval: number = 10000) {
  const [statusData, setStatusData] = useState<MqttStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/mqtt/api/status/`);

      if (!response.ok) {
        throw new Error('Failed to fetch MQTT status');
      }

      const data: MqttStatusData = await response.json();
      setStatusData(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('MQTT status fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, refreshInterval]);

  return {
    statusData,
    loading,
    error,
    lastUpdate,
    refetch: fetchStatus
  };
}

/**
 * Hook for real-time sensor data for a specific site
 */
export function useMqttSensorData(siteId: string | number | null, refreshInterval: number = 5000) {
  const [sensorData, setSensorData] = useState<MqttSensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchSensorData = useCallback(async () => {
    if (!siteId) {
      setSensorData([]);
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/mqtt/api/sensors/${siteId}/`);

      if (!response.ok) {
        throw new Error('Failed to fetch sensor data');
      }

      const data: MqttSensorResponse = await response.json();
      setSensorData(data.sensors);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('MQTT sensor data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setLoading(true);
    fetchSensorData();

    if (!siteId) return;

    const interval = setInterval(fetchSensorData, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchSensorData, refreshInterval, siteId]);

  return {
    sensorData,
    loading,
    error,
    lastUpdate,
    refetch: fetchSensorData
  };
}

/**
 * Hook to get connection status for a specific site
 */
export function useMqttConnectionStatus(siteId: string | number | null) {
  const { statusData } = useMqttStatus();

  const connectionStatus = statusData?.connections.find(
    conn => conn.id === Number(siteId)
  );

  const siteStats = siteId ? statusData?.sensor_stats[siteId.toString()] : null;

  return {
    connection: connectionStatus,
    stats: siteStats,
    isConnected: connectionStatus?.status === 'connected',
    hasError: connectionStatus?.status === 'error',
    lastHeartbeat: connectionStatus?.last_heartbeat_at
  };
}

/**
 * Hook for controlling MQTT connections (start/stop/restart)
 */
export function useMqttControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controlConnection = useCallback(async (
    siteId: string | number,
    action: 'start' | 'stop' | 'restart'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/mqtt/connection/${siteId}/control/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action,
          csrfmiddlewaretoken: '', // In produzione serve il CSRF token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to control connection');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    controlConnection,
    loading,
    error
  };
}