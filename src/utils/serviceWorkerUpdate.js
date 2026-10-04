/**
 * serviceWorkerUpdate.js
 *
 * Purpose:
 * Decides whether the app should show a visible update prompt when a new production build is available.
 * This protects the user experience by prompting only when the update is real and the app is already in use.
 *
 * Main Responsibilities:
 * - compare the active running service worker version with the waiting build
 * - avoid noisy prompts during first install or inactive state
 * - allow the PWA shell to notify the user that a refresh is recommended
 */
export const shouldPromptForServiceWorkerUpdate = ({
  hasController,
  activeVersion,
  waitingVersion,
  currentVersion,
}) => Boolean(
  hasController
  && waitingVersion
  && waitingVersion === currentVersion
  && activeVersion !== currentVersion,
);