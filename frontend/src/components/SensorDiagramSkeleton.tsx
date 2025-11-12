'use client';

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
];

const SkeletonHorizontalLine = ({ top, position }: { top: string; position: string }) => (
  <div className="hidden md:block">
    <div
      className="absolute h-0.5 w-20 bg-gray-200 dark:bg-gray-700"
      style={{
        top: top,
        [position === "left" ? "right" : "left"]: "80%",
      }}
    />
  </div>
);

export default function SensorDiagramSkeleton() {
  const isMdUp = useIsMdUp();

  return (
    <div className="relative w-fit mx-auto my-[7%] animate-pulse">
      {PORTS.map((port) => {
        const preciseStyle = {
          top: `calc(${port.top} - 16px)`,
          [port.position === "left" ? "right" : "left"]: "calc(90% + 80px)",
        };

        const mobileStyle = {
          top: `calc(${port.top} - 3px)`,
          [port.position === "left" ? "right" : "left"]: "calc(17% + 80px)",
        };

        const currentStyle = isMdUp ? preciseStyle : mobileStyle;

        return (
          <div key={port.id}>
            <SkeletonHorizontalLine top={port.top} position={port.position} />
            <div
              className="absolute flex items-center"
              style={currentStyle}
            >
              <div className="h-10 w-10 md:w-44 rounded-lg bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        );
      })}

      {/* Skeleton per l'SVG principale */}
      <div
        className="w-[300px] h-[450px] rounded-md bg-gray-200 dark:bg-gray-700"
        style={{ maxHeight: '60vh' }}
      />
    </div>
  );
}
