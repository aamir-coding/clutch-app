import React from 'react';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
