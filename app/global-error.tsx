'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, where the
 * normal error boundary has no shell to render into. It must supply its own
 * <html> and <body>, and cannot rely on the design tokens having loaded — so
 * the colours here are literal, deliberately.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#ebeeec',
          color: '#1a1c1d',
          fontFamily: '"Old Standard TT", "Iowan Old Style", "Palatino Linotype", Georgia, serif',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '24rem' }}>
          <h1 style={{ fontSize: '27px', fontWeight: 700, margin: 0 }}>
            Aperture could not start.
          </h1>
          {/*
            The root layout failed, so this boundary knows nothing about drafts
            or about what the composer was holding. Claim less than app/error.tsx
            deliberately: a boundary that knows less should promise less.
          */}
          <p style={{ color: '#434847', fontSize: '17px', lineHeight: 1.6 }}>
            Your saved entries are safe. Reload, and if this keeps happening, quote the
            reference below.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              background: '#1a1c1d',
              color: '#ebeeec',
              border: 0,
              borderRadius: 0,
              padding: '0.5rem 1rem',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '13px', color: '#5b6160' }}>
              reference {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
