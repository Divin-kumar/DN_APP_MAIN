/* Entry screen for Google authentication and local guest sessions. */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import useAppStore from '../store/useAppStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { continueAsGuest } = useGuest();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user || isGuest) {
      navigate(from, { replace: true });
    }
  }, [user, isGuest, from, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      await authService.signInWithGoogle();
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  const handleGuestLogin = () => {
    continueAsGuest();
    navigate(from, { replace: true });
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>DN</h1>
        <p style={styles.subtitle}>Sign in to continue</p>

        <button style={styles.primaryButton} onClick={handleGoogleSignIn}>
          Continue with Google
        </button>

        <button style={styles.secondaryButton} onClick={handleGuestLogin}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, rgba(30,134,109,0.12), transparent 30%), linear-gradient(135deg, #edf7f2 0%, #f8fbf8 100%)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(255,255,255,0.84)',
    border: '1px solid rgba(16, 51, 42, 0.08)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: '0 20px 55px rgba(25, 48, 35, 0.12)',
    padding: '28px 22px',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 'clamp(2rem, 5vw, 2.5rem)',
    color: '#1d3f2c',
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#4b6357',
    fontSize: '0.96rem',
  },
  primaryButton: {
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #2d6a4f 0%, #1e866d 100%)',
    color: '#fff',
    fontSize: '0.98rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: '12px',
    boxShadow: '0 12px 26px rgba(30, 134, 109, 0.2)',
  },
  secondaryButton: {
    width: '100%',
    border: '1px solid #d4e4d9',
    borderRadius: '14px',
    padding: '14px 18px',
    background: '#f6faf7',
    color: '#1d3f2c',
    fontSize: '0.98rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
