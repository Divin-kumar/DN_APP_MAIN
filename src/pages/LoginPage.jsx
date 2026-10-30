/*
  Entry screen for Google authentication and browser-local Guest sessions.
  Keep both existing session handlers and navigation destinations intact.
*/
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import useAppStore from '../store/useAppStore';
import './LoginPagePremium.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { continueAsGuest } = useGuest();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (user || isGuest) navigate(from, { replace: true });
  }, [user, isGuest, from, navigate]);

  const handleGoogleSignIn = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setErrorMessage('');
    try {
      await authService.signInWithGoogle();
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Google sign-in failed:', error);
      if (mountedRef.current) setErrorMessage(
        error?.code === 'auth/popup-closed-by-user'
          ? 'Sign-in was closed. You can try again.'
          : 'Google sign-in is unavailable right now. Try again or continue as Guest.',
      );
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleGuestLogin = () => {
    if (pendingRef.current) return;
    setErrorMessage('');
    try {
      continueAsGuest();
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Guest session could not start:', error);
      setErrorMessage('Guest mode needs browser storage. Check your browser settings and try again.');
    }
  };

  return (
    <main className="dn-login">
      <div className="dn-login-layout">
        <section className="dn-login-story" aria-labelledby="dn-login-headline">
          <div className="dn-login-brand" aria-label="DN">
            <span className="dn-login-brand-mark" aria-hidden="true">D<span>N</span></span>
            <span className="dn-login-brand-name">DN</span>
          </div>
          <div className="dn-login-story-copy">
            <p className="dn-login-eyebrow">Your personal life space</p>
            <h1 id="dn-login-headline">Life happens.<br /><span>Keep the moments.</span></h1>
            <p className="dn-login-description">Bring your moments, plans, memories and finances together in one thoughtful place.</p>
            <div className="dn-login-topics" aria-label="What you can organize">
              <span>Moments</span><span>Activities</span><span>Finances</span><span>Memories</span>
            </div>
          </div>
        </section>

        <section className="dn-login-card" aria-labelledby="dn-login-welcome">
          <div className="dn-login-card-top">
            <p className="dn-login-card-kicker">WELCOME TO DN</p>
            <h2 id="dn-login-welcome">Your space starts here.</h2>
            <p>Choose how you’d like to continue.</p>
          </div>
          <div className="dn-login-actions">
            <button type="button" className="dn-login-google" onClick={handleGoogleSignIn} disabled={busy} aria-busy={busy}>
              <span className="dn-login-google-mark" aria-hidden="true">G</span>
              <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="dn-login-guest" onClick={handleGuestLogin} disabled={busy}>
              <span>Continue as Guest</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          {errorMessage ? (
            <p className="dn-login-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{errorMessage}</p>
          ) : null}
          <p className="dn-login-privacy">Guest records stay in this browser. They aren’t automatically transferred to your Google account.</p>
        </section>
      </div>
      <p className="dn-login-footer">A quieter home for everything that matters.</p>
    </main>
  );
}
