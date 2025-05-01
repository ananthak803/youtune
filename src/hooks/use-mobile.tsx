'use client'; // Ensure this runs only on the client

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Initialize with undefined or a default that matches server render (e.g., false)
  // Using undefined forces a client-side check before rendering dependent UI
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // This function now runs only on the client, after hydration
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Initial check
    checkDevice();

    // Set up listener for resize events
    const handleResize = () => {
      checkDevice();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty dependency array ensures this runs once on mount

  // Return the state. Components using this hook should handle the `undefined` case
  // if they need to render differently before the client-side check completes.
  // Returning `!!isMobile` coerces undefined to false, which might be acceptable
  // if the default/server render assumes non-mobile.
   return isMobile; // Return the actual state, could be undefined initially
   // Or: return !!isMobile; // If you prefer defaulting to false during SSR/initial render
}
