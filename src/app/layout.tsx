import type { Metadata, Viewport } from 'next';
import { Manrope, Sora } from 'next/font/google';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Brainbric Pulse', template: '%s · Brainbric Pulse' },
  description: 'The command portal for Brainbric Innovations: leads, AI agents and deals in one place.',
  icons: { icon: '/brainbric-logo.png', apple: '/brainbric-logo.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#1B181C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
