import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Old_Standard_TT } from 'next/font/google';

import './globals.css';

/**
 * Type, "The Lexicon": one family for everything.
 *
 * Old Standard TT is a revival of the "Modern" faces nineteenth-century
 * dictionaries and reference books were set in. Rank comes from bold, italic
 * and capitals at three sizes, never from a second family or a bigger size.
 */
const oldStandard = Old_Standard_TT({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-text',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aperture',
  description: 'A private place to think.',
  robots: { index: false, follow: false },
  // The tab and home-screen icons come from app/icon.png and app/apple-icon.png
  // by convention. This is only for when someone pastes the link somewhere.
  openGraph: {
    title: 'Aperture',
    description: 'A private place to think.',
    images: [{ url: '/logo.webp', width: 640, height: 551, alt: 'Aperture' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ebeeec' },
    { media: '(prefers-color-scheme: dark)', color: '#131517' },
  ],
};

/**
 * Applies the stored theme before first paint. Without this the page renders
 * in the system theme for one frame and then snaps — which on a near-black
 * design is a flash of white in someone's face at 1am.
 */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem('aperture-theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by middleware. The bootstrap script below is inline, so without this
  // nonce our own Content-Security-Policy would block it — which is precisely
  // what we want to happen to any inline script we did not put there.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={oldStandard.variable}
    >
      <head>
        {/* suppressHydrationWarning: browsers blank a script's nonce attribute
            after reading it, so injected code cannot copy it. React then sees
            "" where the server sent the value and reports a mismatch that is
            really the security feature working. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
