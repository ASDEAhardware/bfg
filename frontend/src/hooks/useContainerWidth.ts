"use client"
import { useState, useEffect, useRef } from 'react'

interface ContainerBreakpoints {
  isMobile: boolean    // < 768px (md)
  isTablet: boolean    // 768px - 1024px (md to lg)
  isDesktop: boolean   // 1024px - 1280px (lg to xl)
  isXLarge: boolean    // >= 1280px (xl+)
  width: number
}

export function useContainerWidth(): [React.RefObject<HTMLDivElement>, ContainerBreakpoints] {
  const containerRef = useRef<HTMLDivElement>(null)
  const [breakpoints, setBreakpoints] = useState<ContainerBreakpoints>({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isXLarge: false,
    width: 0
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateBreakpoints = (width: number) => {
      setBreakpoints({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024 && width < 1280,
        isXLarge: width >= 1280,
        width
      })
    }

    // Set initial size
    updateBreakpoints(element.offsetWidth)

    // Create ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        updateBreakpoints(width)
      }
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return [containerRef, breakpoints]
}