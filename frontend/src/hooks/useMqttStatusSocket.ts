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

      // Assumiamo che il messaggio contenga site_id, status e is_enabled
      const { site_id, status, is_enabled } = data;

      if (site_id !== undefined && status !== undefined && is_enabled !== undefined) {
        // Invalida e/o aggiorna la cache di react-query per i datalogger e lo stato MQTT
        // Questo farà sì che i componenti che usano questi dati si aggiornino automaticamente

        // DIRECTLY update the query cache with the new data from the WebSocket
        queryClient.setQueryData(
          ['mqttConnectionStatus', site_id],
          (oldData: any) => {
            if (!oldData) {
              // If cache is empty, invalidate as a fallback to trigger a full fetch.
              queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', site_id] });
              return undefined;
            }
            // Merge the new status from the WebSocket into the existing cached data
            console.log(`WebSocket: Merging status for site ${site_id}. Old: ${oldData.status}, New: ${status}`);
            return {
              ...oldData,
              status: status,
              is_enabled: is_enabled,
            };
          }
        );

        // Invalidate the dataloggers query, as their online status might have changed.
        // This is less critical and less prone to race conditions, so invalidation is fine here.
        queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });

        toast.info(`Site ${site_id} MQTT status: ${status}`, { duration: 2000 });
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
                  toast.warning(
                    `WebSocket: Attempting to reconnect (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})...`,
                    { id: 'ws-reconnect', duration: RECONNECT_INTERVAL_MS - 500 } // Show for most of the interval
                  );
                  reconnectTimeout.current = setTimeout(connectWebSocket, RECONNECT_INTERVAL_MS);
                } else {
                  console.error('Max WebSocket reconnect attempts reached.');
                  toast.error('WebSocket: Max reconnect attempts reached. Please refresh the page.', { id: 'ws-reconnect', duration: 10000 });
                }
            };
    ws.current.onerror = (error) => {
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