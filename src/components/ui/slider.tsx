
"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group", // Added select-none and group
      className
    )}
    {...props}
  >
    {/* Track: Use custom classes for background, slightly thicker */}
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
       {/* Range: Use custom classes for filled part */}
      <SliderPrimitive.Range className="absolute h-full bg-primary group-hover:bg-accent transition-colors" />
    </SliderPrimitive.Track>
    {/* Thumb: Circular, scales on hover/active, initially less visible */}
    <SliderPrimitive.Thumb
      className={cn(
        "block h-3 w-3 rounded-full border-2 border-primary bg-background ring-offset-background transition-all", // Base styles: circular, border
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", // Focus styles
        "disabled:pointer-events-none disabled:opacity-50", // Disabled styles
        "opacity-0 group-hover:opacity-100", // Fade in on slider hover
        "group-active:scale-125", // Scale up when slider is active (dragging)
        props.disabled && "opacity-50 group-hover:opacity-50", // Ensure disabled thumb doesn't become fully opaque on hover
        !props.disabled && "cursor-pointer" // Add pointer cursor only when enabled
      )} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
