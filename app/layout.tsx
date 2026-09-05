import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { JetBrains_Mono, Silkscreen, Space_Grotesk } from 'next/font/google';

import './globals.css';

/**
 * Type pairing, "Paper Cut":
 *   Space Grotesk — everything. Display, UI, and the journal prose itself.
 *                   Brutalism runs on one loud voice, not a conversation
 *                   between two, so the old serif/sans split is gone.
 *   Silkscreen    — an actual bitmap face for the 10px uppercase labels.
 *                   At that size a pixel font is genuinely CRISPER than an
 *                   antialiased one, so this is functional as well as
 *                   thematic — the "pixels" earn their place.
 *   JetBrains Mono — the ledger, where digits must line up in columns and
 *                   Silkscreen has no tabular figures.
 */

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const silkscreen = Silkscreen({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-silkscreen',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aperture',
  description: 'A private place to think.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffcf2' },
    { media: '(prefers-color-scheme: dark)', color: '#141414' },
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
      className={`${spaceGrotesk.variable} ${silkscreen.variable} ${jetbrains.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
