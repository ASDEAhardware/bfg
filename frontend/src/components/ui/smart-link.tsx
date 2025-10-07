"use client"
import React from 'react'
import NextLink, { LinkProps as NextLinkProps } from 'next/link'
import { useSmartNavigation } from '@/hooks/useSmartNavigation'
import { shouldUseNormalNavigation, getFallbackTitle } from '@/lib/smart-link-global'

interface SmartLinkProps extends Omit<NextLinkProps, 'onClick'> {
  children: React.ReactNode
  className?: string
  title?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  // Prop per disabilitare la navigazione intelligente se necessario
  forceNormalNavigation?: boolean
}

export function Link({
  href,
  children,
  title,
  onClick,
  forceNormalNavigation = false,
  ...props
}: SmartLinkProps) {
  const { navigateIntelligently } = useSmartNavigation()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Se c'è un onClick custom, eseguilo prima
    if (onClick) {
      onClick(e)
      // Se l'onClick custom ha fatto preventDefault, rispettalo
      if (e.defaultPrevented) return
    }

    // Se è esplicitamente richiesta navigazione normale, usala
    if (forceNormalNavigation) return

    // Controlla se deve usare navigazione normale (link esterni, etc.)
    const url = href.toString()
    if (shouldUseNormalNavigation(url)) {
      return // Lascia gestire a Next.js Link
    }

    // Applica navigazione intelligente per link interni
    e.preventDefault()

    // Cerca di determinare un titolo significativo
    let linkTitle = title
    if (!linkTitle && typeof children === 'string') {
      linkTitle = children
    } else if (!linkTitle && React.isValidElement(children)) {
      // Cerca testo dentro elementi React
      const extractText = (element: any): string => {
        if (typeof element === 'string') return element
        if (typeof element === 'number') return element.toString()
        if (React.isValidElement(element) && element.props && typeof element.props === 'object' && 'children' in element.props) {
          const props = element.props as { children: any }
          if (typeof props.children === 'string') return props.children
          if (Array.isArray(props.children)) {
            return props.children.map(extractText).join(' ')
          }
          return extractText(props.children)
        }
        return ''
      }
      linkTitle = extractText(children)
    }

    // Fallback al path se non riusciamo a determinare un titolo
    if (!linkTitle) {
      linkTitle = getFallbackTitle(url) || url.split('/').pop() || url
    }

    navigateIntelligently(url, linkTitle)
  }

  return (
    <NextLink href={href} onClick={handleClick} {...props}>
      {children}
    </NextLink>
  )
}

// Export del tipo per TypeScript
export type { SmartLinkProps as LinkProps }