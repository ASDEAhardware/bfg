"use client";
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketStore, WebSocketStatus } from '@/store/websocketStore';
import { toast } from 'sonner';

// URL del WebSocket (da configurare in base all'ambiente)
// Assumiamo che il WebSocket sia sullo stesso host del backend, ma su porta 8000 e path /ws/status/
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Sostituisci window.location.host con l'host del tuo backend se diverso
  // Ad esempio, se il backend è su localhost:8000, usa 'localhost:8000'
  const host = process.env.NEXT_PUBLIC_BACKEND_WS_HOST || window.location.host.replace(':3000', ':8001');
  return `${protocol}//${host}/ws/status/`;
};

export const useMqttStatusSocket = () => {
  const queryClient = useQueryClient();
  const { setStatus } = useWebSocketStore();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_INTERVAL_MS = 5000; // 5 secondi

  const connectWebSocket = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return; // Già connesso o in fase di connessione
    }

    setStatus('CONNECTING');
    const url = getWebSocketUrl();
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setStatus('CONNECTED');
      reconnectAttempts.current = 0; // Reset tentativi al successo
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket Message:', data);

      // Assumiamo che il messaggio contenga site_id, status e is_enabled
      const { site_id, status, is_enabled } = data;

      if (site_id !== undefined && status !== undefined && is_enabled !== undefined) {
        // Invalida e/o aggiorna la cache di react-query per i datalogger e lo stato MQTT
        // Questo farà sì che i componenti che usano questi dati si aggiornino automaticamente

        // Invalida la query per lo stato della connessione MQTT per il sito specifico
        // Questo farà sì che react-query esegua un refetch dell'API
        queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', site_id] });

        // Invalida anche la query per i datalogger, dato che is_online potrebbe essere cambiato
        queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });

        toast.info(`Site ${site_id} MQTT status: ${status}`, { duration: 2000 });
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket Disconnected', event.code, event.reason);
      setStatus('DISCONNECTED');
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})...`);
        reconnectTimeout.current = setTimeout(connectWebSocket, RECONNECT_INTERVAL_MS);
      } else {
        console.error('Max WebSocket reconnect attempts reached.');
        toast.error('WebSocket: Max reconnect attempts reached.', { duration: 5000 });
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket Error - Connection failed or lost');
      setStatus('DISCONNECTED');
      ws.current?.close(); // Chiude per innescare onclose e il tentativo di riconnessione
    };
  }, [queryClient, setStatus]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connectWebSocket]);

  // Espone lo stato della connessione WebSocket
  return useWebSocketStore((state) => state.status);
};