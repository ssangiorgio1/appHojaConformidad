import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/AuthContext';
import { AppShellBehavior } from '@/components/AppShellBehavior';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Panel WARA',
  description: 'Hojas de conformidad de instalación',
  manifest: '/manifest.webmanifest',
  // iOS: instalada desde Safari ("Agregar a inicio") abre sin barra del navegador, con la barra de estado
  // translúcida sobre el header.
  appleWebApp: { capable: true, title: 'Panel WARA', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#6b142a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Habilita env(safe-area-inset-*) en iOS (notch / barra inferior).
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppShellBehavior />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
