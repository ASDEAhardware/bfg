"use client";

import { useMqttStatusSocket } from '@/hooks/useMqttStatusSocket';
import { useEffect } from 'react';

/**
 * This component's only purpose is to initialize the global MQTT status
 * WebSocket connection from a single, stable point in the application tree.
 * It should be mounted once in the root layout.
 */
export const WebSocketInitializer = () => {
  // Initialize the WebSocket connection by calling the hook.
  // The hook's internal logic handles the entire lifecycle.
  useMqttStatusSocket();

  // This component renders nothing.
  return null;
};