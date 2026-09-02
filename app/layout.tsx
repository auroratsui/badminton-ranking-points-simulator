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

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {isGitHubPages && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  var sc_project=13353075;
                  var sc_invisible=1;
                  var sc_security="46167cc0";
                `,
              }}
            />
            <script src="https://www.statcounter.com/counter/counter.js" async />
            <noscript>
              <div className="statcounter">
                <a
                  title="web statistics"
                  href="https://statcounter.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    className="statcounter"
                    src="https://c.statcounter.com/13353075/0/46167cc0/1/"
                    alt="web statistics"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </a>
              </div>
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
