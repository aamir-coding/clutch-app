import React from 'react';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';

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
      </body>
    </html>
  );
}