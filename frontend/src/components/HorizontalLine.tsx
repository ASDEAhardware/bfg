interface HorizontalLineProps {
  top: string;
  position: "left" | "right";
  lineColorClass: string;
  className?: string;
  diagramType: 'DEFAULT' | 'ADAQ4' | 'MONSTR';
}

export function HorizontalLine({ top, position, lineColorClass, className, diagramType }: HorizontalLineProps) {
  
  // Applica un offset diverso per il layout ADAQ4
  const horizontalPosition = diagramType === 'ADAQ4' ? '98%' : '87%';
  const startDotPosition = diagramType === 'ADAQ4' ? 'calc(98% - 4px)' : 'calc(87% - 4px)';
  const endDotPosition = diagramType === 'ADAQ4' ? 'calc(92% + 82px)' : 'calc(80% + 82px)';

  return (
    <div className={className}>
      {/* Horizontal line */}
      <div
        className={`absolute h-0.5 w-17 ${lineColorClass}`}
        style={{
          top: top,
          [position === "left" ? "right" : "left"]: horizontalPosition,
        }}
      />

      {/* Start dot */}
      <div
        className={`absolute w-2 h-2 rounded-full ${lineColorClass}`}
        style={{
          top: `calc(${top} - 3px)`,
          [position === "left" ? "right" : "left"]: startDotPosition,
        }}
      />

      {/* End dot */}
      <div
        className={`absolute w-2 h-2 rounded-full ${lineColorClass}`}
        style={{
          top: `calc(${top} - 3px)`,
          [position === "left" ? "right" : "left"]: endDotPosition,
        }}
      />
    </div>
  );
}
