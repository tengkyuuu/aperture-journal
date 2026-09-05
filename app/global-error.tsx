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
          background: '#0b0b0c',
          color: '#f3efe7',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '24rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 300, margin: 0 }}>
            Aperture could not start.
          </h1>
          <p style={{ color: '#a9a9b4', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Nothing you wrote was lost. Reload, and if this keeps happening, quote the
            reference below.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              background: '#8b99e6',
              color: '#0b0b0c',
              border: 0,
              borderRadius: 6,
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.6875rem', color: '#6b6b75' }}>
              reference {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
