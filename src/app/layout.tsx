import type { Metadata } from 'next';
import './globals.css';
import { TopNavbar } from '../components/navigation/TopNavbar';

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
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50 min-h-screen">
        <TopNavbar />
        {children}
      </body>
    </html>
  );
}
