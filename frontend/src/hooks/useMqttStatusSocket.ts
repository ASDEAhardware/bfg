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
  const isIntentionalClose = useRef(false); // Flag per chiusure volontarie
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_INTERVAL_MS = 5000; // 5 secondi

  const connectWebSocket = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return; // Già connesso o in fase di connessione
    }

    setStatus('CONNECTING');
    const url = getWebSocketUrl();
    console.log('Connecting to WebSocket URL:', url);
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setStatus('CONNECTED');
      reconnectAttempts.current = 0; // Reset tentativi al successo
      isIntentionalClose.current = false; // Reset flag chiusura volontaria
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket Message:', data);

      const { type, site_id } = data;

      // Gestisci diversi tipi di eventi MQTT
      if (type) {
        switch (type) {
          case 'connection_established':
            // WebSocket connesso
            console.log('WebSocket connection established');
            break;

          case 'mqtt_status':
          case 'status_update':
            // Update dello status della connessione MQTT (con is_active)
            if (site_id !== undefined) {
              const { status, is_active } = data;
              if (status !== undefined && is_active !== undefined) {
                queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', site_id] });
                queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
                toast.info(`Site ${site_id} MQTT status: ${status}`, { duration: 2000 });
              }
            }
            break;

          case 'datalogger_update':
            // Update di un datalogger specifico
            if (site_id !== undefined) {
              console.log(`Datalogger update for site ${site_id}:`, data);
              queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
              // Se c'è un datalogger_id, invalida anche le query specifiche per quel datalogger
              if (data.datalogger_id) {
                queryClient.invalidateQueries({ queryKey: ['sensors', data.datalogger_id] });
              }
            }
            break;

          case 'gateway_update':
          case 'gateway_offline':
            // Update del gateway
            if (site_id !== undefined) {
              console.log(`Gateway update for site ${site_id}:`, data);
              queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
              queryClient.invalidateQueries({ queryKey: ['gateways', site_id] });
            }
            break;

          case 'sensor_offline':
            // Sensore offline
            if (site_id !== undefined) {
              console.log(`Sensor offline for site ${site_id}:`, data);
              if (data.datalogger_id) {
                queryClient.invalidateQueries({ queryKey: ['sensors', data.datalogger_id] });
              }
              queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
            }
            break;

          default:
            // Evento non riconosciuto, invalida comunque i datalogger per sicurezza se c'è site_id
            console.log(`Unknown WebSocket event type: ${type}`, data);
            if (site_id !== undefined) {
              queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
            }
            break;
        }
      }
    };

    ws.current.onclose = (event) => {
      // Non loggare errori per chiusure volontarie (F5, navigazione, chiusura tab)
      if (!isIntentionalClose.current) {
        // Codice 1006 = chiusura anomala (server down, rete persa, ecc.)
        // Codice 1000 = chiusura normale
        // Codice 1001 = endpoint andato via (es. navigazione)
        const closeReason = event.code === 1006
          ? 'Connection lost (server may be down or network issue)'
          : event.reason || `Close code: ${event.code}`;

        console.log('WebSocket Disconnected:', closeReason);
      }

      setStatus('DISCONNECTED');

      // Non tentare la riconnessione se la chiusura è volontaria
      if (isIntentionalClose.current) {
        return;
      }

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})...`);
        reconnectTimeout.current = setTimeout(connectWebSocket, RECONNECT_INTERVAL_MS);
      } else {
        console.error('Max WebSocket reconnect attempts reached.');
        toast.error('WebSocket: Max reconnect attempts reached.', { duration: 5000 });
      }
    };

    ws.current.onerror = () => {
      // Non loggare errori se stiamo chiudendo volontariamente
      if (!isIntentionalClose.current) {
        console.error('WebSocket Error - Connection failed or lost');
      }
      setStatus('DISCONNECTED');
      ws.current?.close(); // Chiude per innescare onclose e il tentativo di riconnessione
    };
  }, [queryClient, setStatus]);

  useEffect(() => {
    // Introduce a small initial delay before the first connection attempt
    // to give the application and backend a moment to stabilize.
    const initialConnectTimeout = setTimeout(() => {
      connectWebSocket();
    }, 1000); // 1 second delay for initial connection

    // Handler per chiusura pagina (F5, navigazione, chiusura tab)
    const handleBeforeUnload = () => {
      isIntentionalClose.current = true;
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      clearTimeout(initialConnectTimeout); // Clear initial delay if unmounting before it fires
    };

    // Handler per visibilità pagina (quando l'utente cambia tab)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pagina nascosta - non fare nulla per ora
      } else {
        // Pagina tornata visibile - controlla connessione
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
          isIntentionalClose.current = false;
          reconnectAttempts.current = 0; // Reset tentativi
          connectWebSocket();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isIntentionalClose.current = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      clearTimeout(initialConnectTimeout);
    };
  }, [connectWebSocket]);

  // Espone lo stato della connessione WebSocket
  return useWebSocketStore((state) => state.status);
};