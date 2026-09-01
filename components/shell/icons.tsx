/**
 * Hand-drawn 20px icons on a 1.5px stroke.
 *
 * No icon library. Five glyphs do not justify a dependency, and drawing them
 * here means the stroke weight matches the hairlines used everywhere else in
 * the interface instead of almost matching them.
 */

type IconProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function IconToday({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 15.5 15.1 4.4a1.9 1.9 0 0 1 2.7 2.7L6.7 18.2 3 19z" />
      <path d="M13 6.5 15.9 9.4" />
    </svg>
  );
}

export function IconInsights({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 16.5h14" />
      <path d="M5.5 16.5V11" />
      <path d="M9 16.5V6.5" />
      <path d="M12.5 16.5v-7" />
      <path d="M16 16.5V4" />
    </svg>
  );
}

export function IconAsk({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2 17.5 17.5" />
    </svg>
  );
}

export function IconVault({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="8.5" width="13" height="9" rx="2" />
      <path d="M6.75 8.5V6a3.25 3.25 0 0 1 6.5 0v2.5" />
      <circle cx="10" cy="13" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSecurity({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.5 16.5 5v5c0 4-2.8 6.6-6.5 7.5C6.3 16.6 3.5 14 3.5 10V5z" />
      <path d="m7.5 10 1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2.6v1.6M10 15.8v1.6M2.6 10h1.6M15.8 10h1.6M4.8 4.8l1.1 1.1M14.1 14.1l1.1 1.1M15.2 4.8l-1.1 1.1M5.9 14.1l-1.1 1.1" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16.2 11.8A6.8 6.8 0 0 1 8.2 3.8a6.9 6.9 0 1 0 8 8z" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 10h11" />
      <path d="m10 5.5 4.5 4.5-4.5 4.5" />
    </svg>
  );
}
