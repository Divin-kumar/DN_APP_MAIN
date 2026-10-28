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

// An older app can update its registered URL (for example ?v=1.0.35) to
// the new worker bytes before reloading. Ask the worker for its actual version
// so that URL alone cannot trigger a second prompt for an already-applied build.
// Workers from earlier releases retain their URL-version fallback.
export const readServiceWorkerVersion = (worker, timeoutMs = 500) => {
  let fallback = null;
  try { fallback = new URL(worker?.scriptURL).searchParams.get('v'); } catch { /* No usable legacy URL. */ }
  if (!worker || typeof MessageChannel !== 'function') return Promise.resolve(fallback);
  return new Promise((resolve) => {
    let channel;
    let timer;
    let finished = false;
    const finish = (version) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      channel?.port1.close();
      channel?.port2.close();
      resolve(version);
    };
    try {
      channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (data?.type === 'DN_BUILD_VERSION' && typeof data.version === 'string' && data.version) finish(data.version);
      };
      timer = setTimeout(() => finish(fallback), timeoutMs);
      worker.postMessage({ type:'DN_BUILD_VERSION' }, [channel.port2]);
    } catch { finish(fallback); }
  });
};
