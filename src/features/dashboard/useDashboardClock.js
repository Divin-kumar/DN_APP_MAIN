import { useEffect, useState } from 'react';

export default function useDashboardClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = globalThis.setInterval(update, 60_000);
    globalThis.window?.addEventListener('focus', update);
    globalThis.document?.addEventListener('visibilitychange', update);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.window?.removeEventListener('focus', update);
      globalThis.document?.removeEventListener('visibilitychange', update);
    };
  }, []);
  return now;
}
