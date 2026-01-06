import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Inspire Web Spaces - Private Web Space Registry',
  description: 'Register your Inspire Web Space on the Worldwide Bible Web. A faith-aligned, private internet architecture for trust, safety, and purpose.',
  keywords: ['Inspire Web Spaces', 'IWS', 'Worldwide Bible Web', 'WWBW', 'Jubilee Browser', 'Private Internet', 'Faith-Based Infrastructure'],
  openGraph: {
    title: 'Inspire Web Spaces',
    description: 'Your global web space starts here. Register on the Worldwide Bible Web.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </body>
    </html>
  );
}
