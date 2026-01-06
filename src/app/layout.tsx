import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/lib/queryClient';
import { LocaleProvider } from '@/lib/LocaleContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider';
import SafariDetector from '@/components/SafariDetector';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WeatherFlow',
  description: 'Minimal, elegant, city-first weather app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WeatherFlow',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#22d3ee',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Safari Detection - Must run first */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var ua = navigator.userAgent.toLowerCase();
                if (ua.includes("safari") && !ua.includes("chrome")) {
                  document.documentElement.classList.add("safari");
                }
              })();
            `,
          }}
        />
        {/* Prevent theme flash: set html class before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('weatherflow-theme');
                  var theme = (saved === 'light' || saved === 'dark')
                    ? saved
                    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  var root = document.documentElement;
                  root.classList.remove('light','dark');
                  root.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <SafariDetector />
        <ThemeProvider>
          <QueryProvider>
            <LocaleProvider>
              <ServiceWorkerProvider />
              {children}
            </LocaleProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
