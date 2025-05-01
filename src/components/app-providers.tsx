// src/components/app-providers.tsx
'use client';

import React, { useEffect, useState } from 'react';

// This component can be used to wrap your layout with any client-side only providers
// or components that need to run effects after hydration.

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // You could potentially initialize the zustand store hydration here if needed,
    // though the `persist` middleware often handles this automatically.
    // For example: usePlaylistStore.persist.rehydrate();
  }, []);

  // Render children only after the component has mounted on the client
  // This helps prevent hydration mismatches with components relying on client state (like zustand)
  if (!isMounted) {
    // Optionally return a loading state or null during server render / hydration phase
    return null;
  }

  return <>{children}</>;
}
