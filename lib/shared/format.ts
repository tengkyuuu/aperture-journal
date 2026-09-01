import type { Mood } from './types';

/** "just now" · "14m" · "3h" · "Yesterday" · "12 Aug" */
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);

  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;

  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d`;

  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "Tuesday, 2 September" — for the Today header. */
export function longDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Map mood valence to a colour token.
 *
 * Always paired with `mood.label` in the UI — colour alone is never the
 * encoding, both because roughly one in twelve men cannot reliably separate
 * these hues and because "a slightly reddish dot" is not information.
 */
export function moodColor(mood: Mood | null): string {
  if (!mood) return 'var(--fg-muted)';
  if (mood.valence > 0.25) return 'var(--positive)';
  if (mood.valence < -0.25) return 'var(--negative)';
  return 'var(--accent)';
}

/** Opacity carries energy, so a flat day reads flatter than a charged one. */
export function moodOpacity(mood: Mood | null): number {
  if (!mood) return 0.4;
  return 0.45 + Math.min(Math.max(mood.energy, 0), 1) * 0.55;
}

export function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
