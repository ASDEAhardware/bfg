"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUnifiedSiteContext } from '@/hooks/useUnifiedSiteContext'
import { useSiteContextDiagnostics, useIsInSectionMode } from '@/hooks/useUnifiedSiteContext'

export default function TestTabIsolationPage() {
  const { selectedSite, selectedSiteId, sites } = useUnifiedSiteContext()
  const diagnostics = useSiteContextDiagnostics()
  const isInSectionMode = useIsInSectionMode()

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Tab Isolation Test Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium">Current Site</h3>
              <p className="text-sm text-muted-foreground">
                {selectedSite ? selectedSite.name : 'No site selected'}
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {selectedSiteId || 'null'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium">Context Type</h3>
              <div className="flex flex-col gap-1">
                <Badge variant={diagnostics.isSectionIsolated || diagnostics.isTabIsolated ? "default" : "secondary"}>
                  {diagnostics.contextType}
                  {isInSectionMode && " (section)"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {diagnostics.inheritanceInfo}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Available Sites</h3>
            <div className="space-y-1">
              {sites.map(site => (
                <div key={site.id} className="text-xs flex justify-between">
                  <span>{site.name}</span>
                  <Badge variant={site.id === selectedSiteId ? "default" : "outline"} className="text-xs">
                    {site.id === selectedSiteId ? "Selected" : "Available"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Diagnostics</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Section ID: {diagnostics.sectionId || 'null'}</p>
              <p>Tab ID: {diagnostics.tabId || 'null'}</p>
              <p>Is Section Isolated: {diagnostics.isSectionIsolated ? 'Yes' : 'No'}</p>
              <p>Is Tab Isolated: {diagnostics.isTabIsolated ? 'Yes' : 'No'}</p>
              <p>Inherited from Tab: {diagnostics.inheritedFromTab ? 'Yes' : 'No'}</p>
              <p>Inherited from Global: {diagnostics.inheritedFromGlobal ? 'Yes' : 'No'}</p>
              <p>Sites Count: {diagnostics.sitesCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ol className="list-decimal list-inside space-y-1">
            <li>Open this page in normal mode (should show &quot;global&quot; context)</li>
            <li>Enable tab mode and open multiple tabs of this page</li>
            <li>Each tab should show its own tab ID and &quot;tab&quot; context type</li>
            <li>Enable grid mode and assign this page to different grid sections</li>
            <li>Each section should show its own section ID and &quot;section&quot; context type</li>
            <li>Change site selection in individual tabs/sections using their site selectors</li>
            <li>Verify other tabs/sections maintain their independent site selection</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}