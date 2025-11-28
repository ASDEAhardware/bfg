import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Interfaccia per lo stato di un singolo diagramma
type DiagramSensors = Record<string, string | null>;

// 1. Aggiorniamo l'interfaccia dello stato
interface SensorConfigState {
  diagrams: Record<string, DiagramSensors>; // Stato annidato per diagramma
  setSelectedSensor: (diagramId: string, portId: string, sensor: string) => void;
  removeSensor: (diagramId: string, portId: string) => void;
}

export const useSensorConfigStore = create<SensorConfigState>()(
  persist(
    (set) => ({
      // 2. Aggiorniamo lo stato iniziale
      diagrams: {},
      
      // 3. Aggiorniamo l'azione setSelectedSensor
      setSelectedSensor: (diagramId, portId, sensor) =>
        set((state) => ({
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...state.diagrams[diagramId],
              [portId]: sensor,
            },
          },
        })),

      // 4. Aggiorniamo l'azione removeSensor
      removeSensor: (diagramId, portId) =>
        set((state) => {
          // Copia i sensori per il diagramma specifico
          const newPortsForDiagram = { ...(state.diagrams[diagramId] || {}) };
          // Rimuovi la porta
          delete newPortsForDiagram[portId];
          // Ritorna il nuovo stato
          return {
            diagrams: {
              ...state.diagrams,
              [diagramId]: newPortsForDiagram,
            },
          };
        }),
    }),
    {
      name: 'sensor-configuration-storage', // Nome univoco per il localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
