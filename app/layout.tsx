import React from 'react';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'CLUTCH',
  description: 'Workspace Risk Controller & High-Stakes Deadline Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#06060A] text-slate-100 min-h-screen">
        <AuthProvider>{children}</AuthProvider>
        {/*
         * Sonner's Toaster must be mounted once at the root so that
         * toast.success() / toast.error() calls anywhere in the app
         * actually render. Without this, every toast silently drops.
         */}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          toastOptions={{
            style: {
              background: '#12121A',
              border: '1px solid #1E1E2E',
              color: '#F8FAFC',
              fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
            },
          }}
        />
      </body>
    </html>
  );
}