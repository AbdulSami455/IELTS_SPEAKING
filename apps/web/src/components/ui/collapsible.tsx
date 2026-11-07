"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "cn"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

function CollapsibleContent({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  // Base UI measures the panel and sets an inline width; cap it so wide tables scroll instead of overflowing.
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" className={cn("min-w-0 max-w-full", className)} {...props} />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
