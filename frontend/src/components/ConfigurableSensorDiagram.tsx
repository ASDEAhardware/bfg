import React from 'react';
import { useSensorConfigStore } from '@/store/sensorConfigStore';
import { SensorDropdown } from './sensor-dropdown';
import { HorizontalLine } from './HorizontalLine';
import { useTheme } from 'next-themes';
import { SENSOR_TYPES } from '@/config/sensors';
import { useIsMdUp } from '@/hooks/sensor/useIsMdUp';

// 1. Definiamo le props del componente, aggiungendo diagramType
interface ConfigurableSensorDiagramProps {
  SvgComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  diagramType: 'DEFAULT' | 'ADAQ4' | 'MONSTR'; // Aggiunto 'MONSTR'
}

// 2. Centralizziamo i layout
const DIAGRAM_LAYOUTS = {
  DEFAULT: [
    { id: "port-1", top: "7%", position: "left" },
    { id: "port-2", top: "7%", position: "right" },
    { id: "port-3", top: "22.5%", position: "left" },
    { id: "port-4", top: "23%", position: "right" },
    { id: "port-5", top: "38%", position: "left" },
    { id: "port-6", top: "38%", position: "right" },
    { id: "port-7", top: "54%", position: "left" },
    { id: "port-8", top: "54%", position: "right" },
  ],
  ADAQ4: [
    { id: "port-3", top: "18%", position: "left" },
    { id: "port-4", top: "18%", position: "right" },
    { id: "port-5", top: "38%", position: "left" },
    { id: "port-6", top: "38%", position: "right" },
  ],
  MONSTR: [], // Layout vuoto per MonStr.svg
} as const;
//  Aggiungendo as const alla fine della dichiarazione del
//   nostro oggetto DIAGRAM_LAYOUTS, diciamo a TypeScript: "Tratta questo oggetto e
//   tutte le sue proprietà come costanti immutabili con i tipi più specifici
//   possibili".


export default function ConfigurableSensorDiagram({ SvgComponent, diagramType }: ConfigurableSensorDiagramProps) {

  const theme = useTheme();
  const { selectedSensors, setSelectedSensor, removeSensor } = useSensorConfigStore();

  const textColorClass = theme.theme === "light" ? "text-black" : "text-green-500";
  const lineColorClass = theme.theme === "light" ? "bg-gray-700" : "bg-green-500";

  const isMdUp = useIsMdUp(); 

  // 3. Selezioniamo dinamicamente il layout
  const portsToRender = DIAGRAM_LAYOUTS[diagramType] || DIAGRAM_LAYOUTS.DEFAULT;
  
  const handleSelectSensor = (portId: string, sensor: string) => {
    setSelectedSensor(portId, sensor);
  }

  const handleRemoveSensor = (portId: string) => {
    removeSensor(portId);
  }

  return (
    <div className="relative w-fit mx-auto my-[7%]">
      
      {/* 4. Mappiamo il layout corretto */}
      {portsToRender.map((port) => {
        // Logica per l'offset orizzontale specifico per ADAQ4 per i dropdown
        const horizontalOffset = diagramType === 'ADAQ4' ? 'calc(100% + 80px)' : 'calc(90% + 80px)';

        const preciseStyle = {
            top: `calc(${port.top} - 16px)`,
            [port.position === "left" ? "right" : "left"]: horizontalOffset, 
        };

        const mobileStyle = {
            top: `calc(${port.top} - 3px)`, 
            [port.position === "left" ? "right" : "left"]: "calc(17% + 80px)", 
        };

        const currentStyle = isMdUp ? preciseStyle : mobileStyle;
        const visibilityClass = 'flex';

        return (
          <div key={port.id}>
            <HorizontalLine
              top={port.top}
              position={port.position}
              lineColorClass={lineColorClass}
              className="hidden md:block"
              diagramType={diagramType} // Passa la prop qui
            />
            <div
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

      {/* Contenitore per dare una dimensione responsive all'SVG */}
      <div className="w-48 h-[60vh] md:w-64 lg:w-[300px]">
        <SvgComponent 
          className={`w-full h-full select-none ${textColorClass}`} 
        />
      </div>
    </div>
  );
}