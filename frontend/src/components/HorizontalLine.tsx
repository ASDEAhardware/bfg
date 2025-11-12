interface HorizontalLineProps {
  top: string;
  position: "left" | "right";
  lineColorClass: string;
  className?: string;
}

export function HorizontalLine({ top, position, lineColorClass, className }: HorizontalLineProps) {
  return (
    <div className={className}>
      {/* Horizontal line */}
      <div
        className={`absolute h-0.5 w-20 ${lineColorClass}`}
        style={{
          top: top,
          [position === "left" ? "right" : "left"]: "80%",
        }}
      />

      {/* Start dot */}
      <div
        className={`absolute w-2 h-2 rounded-full ${lineColorClass}`}
        style={{
          top: `calc(${top} - 3px)`,
          [position === "left" ? "right" : "left"]: `calc(80% - 4px)`,
        }}
      />

      {/* End dot */}
      <div
        className={`absolute w-2 h-2 rounded-full ${lineColorClass}`}
        style={{
          top: `calc(${top} - 3px)`,
          [position === "left" ? "right" : "left"]: `calc(80% + 80px - 4px)`,
        }}
      />
    </div>
  );
}
