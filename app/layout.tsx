import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google';

import './globals.css';

/**
 * Type pairing, from docs/05-UI-UX-SPEC.md:
 *   Newsreader  — everything a human or the model *writes*
 *   Inter       — everything the product says *about* itself
 *   JetBrains   — the ledger, ids, and anything with digits in a column
 *
 * That split is the whole personality of the app: a notebook, not a chatbot.
 */

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
