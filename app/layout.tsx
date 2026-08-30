import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Badminton World Ranking Points Simulator',
  description: 'Simulate BWF world ranking points for multiple players across tournament outcomes.',
  openGraph: {
    title: 'Badminton World Ranking Points Simulator',
    description: 'Simulate BWF world ranking points for multiple players across tournament outcomes.',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Badminton World Ranking Points Simulator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Badminton World Ranking Points Simulator',
    description: 'Simulate BWF world ranking points for multiple players across tournament outcomes.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
