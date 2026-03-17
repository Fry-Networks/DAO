import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { Suspense } from 'react';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-[var(--text-secondary)]">Loading...</div>}>
        </Suspense>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
