"use client";
import React from "react";
import { Building2 } from "lucide-react";

interface DeviceHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function DeviceHeader({
  title,
  subtitle,
  icon,
  actions,
  children
}: DeviceHeaderProps) {
  return (
    <div className="bg-background border-b border-border">
      <div className="px-4 py-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
          {/* Left section: Icon + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {icon || <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right section: Actions */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Additional content below header */}
        {children}
      </div>
    </div>
  );
}