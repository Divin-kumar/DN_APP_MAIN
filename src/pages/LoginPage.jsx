/*
  Entry screen for Google authentication and browser-local Guest sessions.
  Keep both existing session handlers and navigation destinations intact.
*/
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import useAppStore from '../store/useAppStore';
import useOfflineStatus from '../hooks/useOfflineStatus';
import './LoginPagePremium.css';

const googleErrors = {
  'auth/popup-closed-by-user': 'Sign-in was closed. You can try again.',
  'auth/cancelled-popup-request': 'Sign-in was interrupted. Try again when you’re ready.',
  'auth/popup-blocked': 'Allow pop-ups for DN in your browser, then try Google sign-in again.',
  'auth/network-request-failed': 'Couldn’t reach Google. Check your connection and try again.',
};

function returnDestination(from) {
  const path = from?.pathname;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')
      || path.includes('\\') || path.replace(/\/+$/, '').toLowerCase() === '/login') return '/dashboard';
  return { pathname: path, search: from.search || '', hash: from.hash || '' };
}

export default function LoginPage() {
  const location = useLocation();
  const { continueAsGuest } = useGuest();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const authReady = useAppStore((state) => state.authReady);
  const offline = useOfflineStatus();
  const [phase, setPhase] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const pending = useRef(null);

  useEffect(() => {
    if (useAppStore.getState().logoutRequested) useAppStore.setState({ logoutRequested: false });
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (pending.current && !previous.authReady && state.authReady && !state.user && !state.isGuest) {
        pending.current = null;
        setPhase('idle');
        setErrorMessage('Sign-in ended before your workspace opened. Try again.');
      }
    });
    return () => { pending.current = null; unsubscribe(); };
  }, []);

  const handleGoogleSignIn = async () => {
    if (pending.current || offline || !authReady) return;
    const attempt = {};
    pending.current = attempt;
    setPhase('google');
    setErrorMessage('');
    try {
      await authService.signInWithGoogle();
      if (pending.current === attempt) setPhase('opening');
    } catch (error) {
      if (pending.current !== attempt) return;
      pending.current = null;
      setPhase('idle');
      setErrorMessage(googleErrors[error?.code] || 'Google sign-in is unavailable right now. Try again or continue as Guest.');
    }
  };

  const handleGuestLogin = () => {
    if (pending.current || !authReady) return;
    setErrorMessage('');
    try {
      continueAsGuest();
    } catch {
      setErrorMessage('Guest mode needs browser storage. Check your browser settings and try again.');
    }
  };

  if (authReady && (user || isGuest)) return <Navigate to={returnDestination(location.state?.from)} replace />;

  const busy = phase !== 'idle' || !authReady;
  const status = phase === 'opening' || (phase === 'google' && !authReady) ? 'Opening your workspace…'
    : phase === 'google' ? 'Connecting to Google…' : !authReady ? 'Checking your session…'
    : offline ? 'You’re offline. Continue as Guest or reconnect to sign in with Google.' : '';

  return (
    <main className="dn-login">
      <div className="dn-login-layout">
        <section className="dn-login-story" aria-labelledby="dn-login-headline">
          <div className="dn-login-brand" aria-label="DN">
            <span className="dn-login-brand-mark" aria-hidden="true">D<span>N</span></span>
            <span className="dn-login-brand-name">DN</span>
          </div>
          <div className="dn-login-story-copy">
            <h1 id="dn-login-headline">Life happens.<br /><span>Keep the moments.</span></h1>
            <p className="dn-login-description">Keep your moments, tasks and transactions together.</p>
          </div>
        </section>

        <section className="dn-login-card" aria-labelledby="dn-login-welcome">
          <div className="dn-login-card-top">
            <h2 id="dn-login-welcome">Your space starts here.</h2>
          </div>
          <div className="dn-login-actions">
            <button type="button" className="dn-login-google" onClick={handleGoogleSignIn} disabled={busy || offline} aria-busy={phase !== 'idle'} aria-describedby="dn-login-privacy">
              <span className="dn-login-google-mark" aria-hidden="true">G</span>
              <span>Continue with Google</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="dn-login-guest" onClick={handleGuestLogin} disabled={busy}>
              <span>Continue as Guest</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="dn-login-status" role="status">{status}</p>
          {errorMessage ? (
            <p className="dn-login-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{errorMessage}</p>
          ) : null}
          <p id="dn-login-privacy" className="dn-login-privacy">Personal Guest records stay in this browser while you use Guest. Signing in with Google starts transferring them to the account you choose. Demo records stay separate.</p>
        </section>
      </div>
    </main>
  );
}
