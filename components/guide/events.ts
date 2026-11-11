/**
 * Window events that open the guides from anywhere, without threading
 * callbacks through the shell. Each listener lives in exactly one component.
 */
export const TOUR_EVENT = 'aperture:tour';
export const HELP_EVENT = 'aperture:help';
export const SHORTCUTS_EVENT = 'aperture:shortcuts';

export const startTour = () => window.dispatchEvent(new Event(TOUR_EVENT));
export const openHelp = () => window.dispatchEvent(new Event(HELP_EVENT));
export const openShortcuts = () => window.dispatchEvent(new Event(SHORTCUTS_EVENT));

/** Set once the tour is finished or skipped, so it never ambushes a returning user. */
export const TOUR_DONE_KEY = 'aperture.tour.v1';
