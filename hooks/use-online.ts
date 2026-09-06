'use client';

import { useSyncExternalStore } from 'react';

/**
 * Is the browser online?
 *
 * The server snapshot is `true`, always. Rendering an "offline" badge during
 * SSR and then hydrating it away would flash a scary, wrong state at everyone
 * on their first paint — and the server genuinely cannot know.
 *
 * Worth remembering at every call site: `navigator.onLine === true` means the
 * machine has a network interface, not that anything is reachable. A captive
 * portal reports online. So this is trustworthy when it says FALSE and merely
 * hopeful when it says true, which is why the copy on the offline path says
 * "nothing was sent" rather than promising to send it later.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
