'use client';

import { useEffect, useState } from 'react';

/**
 * The modifier key to print in shortcut hints: ⌘ on Apple devices, Ctrl
 * everywhere else.
 *
 * The handlers already accept either key. Only the label was Mac-only, which
 * told every Windows and Linux user to press a key their keyboard does not
 * have. Server render says "Ctrl" and Apple devices correct it after mount.
 */
export function useModKey(): string {
  const [key, setKey] = useState('Ctrl');

  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.platform;
    if (/mac|iphone|ipad|ipod/i.test(platform)) setKey('⌘');
  }, []);

  return key;
}
