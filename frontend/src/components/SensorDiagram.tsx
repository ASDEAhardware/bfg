'use client';

import { useSensorConfigStore } from '@/store/sensorConfigStore';
import SensorSVG from '@/assets/svg/mucca.svg';
import { SensorDropdown } from './sensor-dropdown';
import { HorizontalLine } from './HorizontalLine';
import { useTheme } from 'next-themes';
import { SENSOR_TYPES } from '@/config/sensors';
import { useIsMdUp } from '@/hooks/sensor/useIsMdUp';

const PORTS: { id: string; top: string; position: "left" | "right" }[] = [
  { id: "port-1", top: "7%", position: "left" },
  { id: "port-2", top: "7%", position: "right" },
  { id: "port-3", top: "22.5%", position: "left" },
  { id: "port-4", top: "23%", position: "right" },
  { id: "port-5", top: "38%", position: "left" },
  { id: "port-6", top: "38%", position: "right" },
  { id: "port-7", top: "54%", position: "left" },
  { id: "port-8", top: "54%", position: "right" },
]

export default function SensorDiagram() {

  const theme = useTheme();
  const { selectedSensors, setSelectedSensor, removeSensor } = useSensorConfigStore();

  const textColorClass = theme.theme === "light" ? "text-black" : "text-green-500";
  const lineColorClass = theme.theme === "light" ? "bg-gray-700" : "bg-green-500";

  // 1. CHIAMATA CORRETTA DELL'HOOK: All'inizio della funzione componente
  const isMdUp = useIsMdUp(); 
  
  // Le funzioni handle... restano fuori dal return
  const handleSelectSensor = (portId: string, sensor: string) => {
    setSelectedSensor(portId, sensor);
  }

  const handleRemoveSensor = (portId: string) => {
    removeSensor(portId);
  }

  // 2. Unico punto di return del componente
  return (
    <div className="relative w-fit mx-auto my-[7%]">
      
      {PORTS.map((port) => {
        
        // Logica Condizionale: Definiamo lo stile e la visibilità qui, dove 'port' è disponibile.
        
        // Stile preciso per schermi MD+
        const preciseStyle = {
            top: `calc(${port.top} - 16px)`,
            [port.position === "left" ? "right" : "left"]: "calc(90% + 80px)", 
        };

        // Stile 2: Posizionamento su Mobile (Generico)
        // Adattiamo la posizione per schermi piccoli (es. in alto, centrali rispetto al bordo)
        const mobileStyle = {
            // Un valore 'top' generico o basato su una percentuale più gestibile
            top: `calc(${port.top} - 3px)`, 
            [port.position === "left" ? "right" : "left"]: "calc(17% + 80px)", 
        };

        // Applica lo stile preciso solo se isMdUp è true, altrimenti usa un oggetto vuoto
        const currentStyle = isMdUp ? preciseStyle : mobileStyle;
        
        // Determina la classe di visibilità (flex o hidden)
        const visibilityClass = 'flex';


        return ( // <--- Questo è il return della funzione freccia nel .map()
          <div key={port.id}>

            {/* HorizontalLine: Visibilità con classi Tailwind per semplicità */}
            <HorizontalLine
              top={port.top}
              position={port.position}
              lineColorClass={lineColorClass}
              className="hidden md:block" 
            />

            {/* Posizione dei sensori */}
            <div
              // Applichiamo la visibilità e lo stile condizionale
              className={`absolute items-center ${visibilityClass}`}
              style={currentStyle} 
            >
              <SensorDropdown
                portId={port.id}
                sensors={SENSOR_TYPES}
                selectedSensor={selectedSensors[port.id] || null}
                onSelectSensor={(sensor) => handleSelectSensor(port.id, sensor)}
                onRemoveSensor={() => handleRemoveSensor(port.id)}
                position={port.position}
              />
            </div>
          </div>
        );
      })}


      {/* SVG principale */}
      <SensorSVG 
        className={`w-auto select-none my-[5%] ${textColorClass}`} 
        style={{ maxHeight: '60vh' }} 
      />
    </div>
  ); // <--- Questo è il return del componente SensorDiagram
}