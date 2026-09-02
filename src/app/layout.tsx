import type { Metadata } from 'next';
import { Playfair_Display, Montserrat, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AppShell } from '../components/navigation/AppShell';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Apex LTL Freight Operating System & Financial Engine',
  description: 'Enterprise AI-powered LTL freight operating system, multi-carrier rater, split optimizer, dispatch board, and embedded fintech rails',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${montserrat.variable} ${spaceGrotesk.variable} dark`}
    >
      <body className="antialiased bg-[#050507] text-[#f4f4f5] min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
