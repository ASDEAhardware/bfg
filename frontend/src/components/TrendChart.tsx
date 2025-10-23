"use client";
import React from "react";

interface TrendChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export function TrendChart({
  data,
  width = 120,
  height = 40,
  color = "currentColor",
  strokeWidth = 1.5,
  className = ""
}: TrendChartProps) {
  if (!data || data.length < 2) {
    return null;
  }

  // Find min and max values for scaling
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue;

  // If all values are the same, create a flat line in the middle
  const valueRange = range === 0 ? 1 : range;

  // Calculate points for the SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - minValue) / valueRange) * height;
    return { x, y };
  });

  // Create a smooth curve using quadratic Bézier curves
  const smoothPath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const prevPoint = points[index - 1];
    const controlX = (prevPoint.x + point.x) / 2;

    return `${path} Q ${controlX} ${prevPoint.y} ${point.x} ${point.y}`;
  }, '');

  // Create area fill path
  const areaPath = `${smoothPath} L ${width} ${height} L 0 ${height} Z`;

  // Generate unique gradient ID
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`relative ${className}`}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Area fill with gradient */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          opacity="0.6"
        />

        {/* Line */}
        <path
          d={smoothPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 2.5 : 1.5}
            fill={color}
            opacity={index === points.length - 1 ? 1 : 0.7}
            strokeWidth={index === points.length - 1 ? 1 : 0}
            stroke="white"
          />
        ))}
      </svg>
    </div>
  );
}