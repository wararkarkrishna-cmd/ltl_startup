import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LTL Freight Operating System & Financial Engine',
  description: 'Enterprise AI-powered LTL brokerage platform with embedded fintech rails',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
