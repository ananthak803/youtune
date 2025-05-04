
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
      "relative flex w-full touch-none select-none items-center", // Added select-none here
      className
    )}
    {...props}
  >
    {/* Track: Use custom classes for background */}
    <SliderPrimitive.Track className="relative h-full w-full grow overflow-hidden rounded-full bg-inherit">
       {/* Range: Use custom classes for filled part */}
      <SliderPrimitive.Range className="absolute h-full bg-inherit" />
    </SliderPrimitive.Track>
    {/* Thumb: Use custom classes for the handle */}
    <SliderPrimitive.Thumb className={cn(
        "block rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        // Remove default Radix size/positioning, rely on custom classes in player.tsx
        // Remove default Radix size/positioning, rely on custom classes in player.tsx
        // h-5 w-5 are default radix values, we remove them here to allow custom sizing
      )} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
