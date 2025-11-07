import { create } from 'zustand';

export type WebSocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

interface WebSocketState {
  status: WebSocketStatus;
  setStatus: (status: WebSocketStatus) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  status: 'DISCONNECTED',
  setStatus: (status) => set({ status }),
}));
