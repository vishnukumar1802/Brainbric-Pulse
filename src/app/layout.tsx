import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Brainbric Pulse', template: '%s · Brainbric Pulse' },
  description: 'The command portal for Brainbric Innovations: leads, AI agents and deals in one place.',
  icons: { icon: '/brainbric-logo.png', apple: '/brainbric-logo.png' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export const viewport: Viewport = {
  themeColor: '#F7F6F4',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
