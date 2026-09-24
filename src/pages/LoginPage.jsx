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
        <h1 style={styles.title}>LifeHub</h1>
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
    background: 'linear-gradient(135deg, #e8f5ec 0%, #f8fbf8 100%)',
    padding: '16px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 18px 50px rgba(25, 48, 35, 0.12)',
    padding: '32px 24px',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '2.1rem',
    color: '#1d3f2c',
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#4b6357',
    fontSize: '1rem',
  },
  primaryButton: {
    width: '100%',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 18px',
    background: '#2d6a4f',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '12px',
  },
  secondaryButton: {
    width: '100%',
    border: '1px solid #d4e4d9',
    borderRadius: '12px',
    padding: '14px 18px',
    background: '#f6faf7',
    color: '#1d3f2c',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
