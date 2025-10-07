"use client"
import React from 'react'
import { TabBar } from '@/components/TabBar'
import { useTabStore } from '@/store/tabStore'

export function ConditionalTabBar() {
  const { isTabModeEnabled } = useTabStore()

  // Renderizza la TabBar solo se la modalità schede è attiva
  if (!isTabModeEnabled) {
    return null
  }

  return <TabBar />
}