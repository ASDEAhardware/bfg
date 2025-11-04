"use client";

import React from 'react';
import { TabSiteSelector } from '@/components/TabSiteSelector';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTabSiteContext } from '@/contexts/TabSiteContext';
import { useSiteContextDiagnostics } from '@/hooks/useUnifiedSiteContext';
import { Tab } from '@/store/tabStore';
import { Videotape, LayoutDashboard, Shield, MonitorCog, SquareChartGantt } from 'lucide-react';

interface TabContextHeaderProps {
  tab?: Tab;
  showDiagnostics?: boolean;
  className?: string;
}

export function TabContextHeader({
  tab,
  showDiagnostics = false,
  className = ''
}: TabContextHeaderProps) {
  const { isTabIsolated } = useTabSiteContext();
  const diagnostics = useSiteContextDiagnostics();

  // Get plugin icon - same logic as GridSection
  const getPageIcon = (url: string) => {
    switch (url) {
      case '/dashboard':
        return LayoutDashboard;
      case '/staff-admin':
        return Shield;
      case '/system':
        return MonitorCog;
      case '/datalogger':
        return Videotape;
      default:
        return SquareChartGantt;
    }
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 border-b bg-muted/30 ${className}`}>
      {/* Left side - Tab info + Site selector */}
      <div className="flex items-center gap-2">
        {tab && (
          <>
            {(() => {
              const PageIcon = getPageIcon(tab.url);
              return <PageIcon className="h-3 w-3 text-primary flex-shrink-0" />;
            })()}
            <span className="text-xs font-medium">
              {tab.customTitle || tab.title}
            </span>

            {/* Site selector dopo il titolo */}
            <TabSiteSelector
              size="sm"
              variant="outline"
              showInheritanceInfo={true}
            />
          </>
        )}

        {showDiagnostics && (
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-4" />
            <Badge variant={isTabIsolated ? "default" : "secondary"} className="text-xs">
              {diagnostics.contextType}
            </Badge>
            {diagnostics.inheritedFromGlobal && (
              <Badge variant="outline" className="text-xs">
                Inherited
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right side - Spacer */}
      <div className="flex-1"></div>
    </div>
  );
}