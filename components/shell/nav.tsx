import { IconAsk, IconInsights, IconSecurity, IconToday, IconVault } from './icons';

export const NAV = [
  { href: '/today', label: 'Today', Icon: IconToday },
  { href: '/insights', label: 'Insights', Icon: IconInsights },
  { href: '/ask', label: 'Ask your past', Icon: IconAsk },
  { href: '/vault', label: 'Vault', Icon: IconVault },
  { href: '/security', label: 'Security', Icon: IconSecurity },
] as const;

export type NavItem = (typeof NAV)[number];
