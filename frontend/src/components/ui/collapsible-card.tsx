"use client"

import * as React from "react"
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { CardDescription, CardTitle } from "@/components/ui/card"

interface CollapsibleCardProps {
  value: string
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
}

export function CollapsibleCard({
  value,
  title,
  description,
  children,
}: CollapsibleCardProps) {
  return (
    <AccordionItem value={value} className="border-none">
      <AccordionTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-transparent px-6 py-4 text-left font-semibold transition-all hover:bg-accent/50 [&[data-state=open]]:rounded-b-none">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1 text-left">{description}</CardDescription>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="rounded-b-lg border border-t-0 border-border p-6 pt-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}
