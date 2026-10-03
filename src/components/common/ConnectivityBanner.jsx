import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function ConnectivityBanner() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <aside className="connectivity-banner" role="status" aria-live="polite">
      <WifiOff size={16} aria-hidden="true" />
      <span className="connectivity-banner-copy">
        <strong>Offline Mode</strong>
        <span>Changes requiring cloud synchronization are unavailable.</span>
      </span>
    </aside>
  );
}
