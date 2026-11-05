import { flushSync } from 'react-dom';

// Deterministic CSS-safe names, never persisted with original files.
export function momentVisualName(id) {
  let hash = 2166136261;
  for (const char of String(id ?? '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return 'dn-moment-card-' + (hash >>> 0).toString(36);
}

// Progressive enhancement: no animation requirement for navigation or previews.
export function runVisualTransition(update, enabled = true) {
  if (!enabled || typeof document === 'undefined'
      || typeof document.startViewTransition !== 'function'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  let committed = false;
  try {
    const transition = document.startViewTransition(() => {
      committed = true;
      flushSync(update);
    });
    void transition.finished.catch(() => {});
  } catch {
    if (!committed) update();
  }
}
