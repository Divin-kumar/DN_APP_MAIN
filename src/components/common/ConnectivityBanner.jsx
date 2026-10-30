import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import './ConnectivityBannerPremium.css';

export default function ConnectivityBanner() {
  const isGuest = useAppStore((state) => state.isGuest);
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
    <aside
      className={`connectivity-banner dn-offline-indicator${isGuest ? ' is-guest' : ' is-account'}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={isGuest
        ? 'Offline. Guest data is stored on this device and does not automatically transfer to another account.'
        : 'Offline. Cloud saves and synchronization may be unavailable until you reconnect.'}
    >
      <WifiOff size={15} aria-hidden="true" />
      <span className="connectivity-banner-copy">
        <strong>{isGuest ? 'Offline · Guest data stays here' : 'Offline · Cloud unavailable'}</strong>
      </span>
    </aside>
  );
}
