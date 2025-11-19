"use client";

import { useMqttStatusSocket } from "@/hooks/useMqttStatusSocket";

/**
 * Componente Client che inizializza la connessione WebSocket.
 * Deve essere un Client Component perché usa un Client Hook (useMqttStatusSocket).
 * Non renderizza nulla visibile.
 */
export function WebSocketInitializer() {
  useMqttStatusSocket();
  return null;
}
