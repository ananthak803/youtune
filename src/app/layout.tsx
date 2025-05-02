import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a common modern font
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { AppProviders } from '@/components/app-providers';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'YouTune',
  description: 'Spotify-like experience using YouTube audio',
  icons: {
    icon: '/favicon.svg', // Use the new SVG favicon from the public directory
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Add suppression here too, as browser extensions might inject attributes directly onto the body
        suppressHydrationWarning
        className={cn(
          'min-h-screen bg-background font-sans antialiased dark', // Apply dark theme globally
          fontSans.variable
        )}
      >
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
