import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SensorConfigState {
  selectedSensors: Record<string, string | null>;
  setSelectedSensor: (portId: string, sensor: string) => void;
  removeSensor: (portId: string) => void;
}

export const useSensorConfigStore = create<SensorConfigState>()(
  persist(
    (set) => ({
      selectedSensors: {},
      setSelectedSensor: (portId: string, sensor: string) =>
        set((state) => ({
          selectedSensors: {
            ...state.selectedSensors,
            [portId]: sensor,
          },
        })),
      removeSensor: (portId: string) =>
        set((state) => {
          const { [portId]: _, ...remainingSensors } = state.selectedSensors;
          return { selectedSensors: remainingSensors };
        }),
    }),
    {
      name: 'sensor-configuration-storage', // Nome univoco per il localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
