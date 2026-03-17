import './globals.css';
import { Analytics } from '@vercel/analytics/react';

import { Suspense } from 'react';


interface RootLayoutProps {
  children: React.ReactNode;
}


export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full dark">
      <body className="h-full bg-[#0f0f0f] text-[#e0e0e0]">
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-[#999999]">Loading...</div>}>
          </Suspense>
          {children}
          <Analytics />
      </body>
    </html>
  );
}
