/* Local device setup and recovery screen. */
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { principal, principalReady, migrationCandidates, persistentReady, persistenceError, bootstrapDevicePrincipal } = useAuth();
  const [deviceName, setDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [approveLegacyMigration, setApproveLegacyMigration] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (principal && principalReady && persistentReady) navigate(from, { replace: true });
  }, [principal, principalReady, persistentReady, from, navigate]);

  const continueOnDevice = async () => {
    setSubmitting(true);
    setError('');
    try {
      await bootstrapDevicePrincipal({ deviceName, approveLegacyMigration });
      navigate(from, { replace: true });
    } catch (bootstrapError) {
      console.error('Device setup failed:', bootstrapError);
      setError('DN could not prepare local data. Your saved records were not changed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>DN</h1>
        <p style={styles.subtitle}>Your data stays on this device.</p>
        <label style={styles.deviceLabel}>
          Device name
          <input style={styles.deviceInput} value={deviceName || principal?.deviceName || ''} onChange={(event) => setDeviceName(event.target.value)} maxLength={64} placeholder="My device" />
        </label>
        {migrationCandidates.length > 1 ? <div style={styles.migrationNotice}>
          <strong>More than one local profile was found</strong>
          <p>Choose to consolidate these existing profiles under this device. This does not upload data.</p>
          <ul>{migrationCandidates.map((candidate) => <li key={candidate.principalId}>{candidate.principalId} · {candidate.recordCount} records</li>)}</ul>
          <label><input type="checkbox" checked={approveLegacyMigration} onChange={(event) => setApproveLegacyMigration(event.target.checked)} /> I approve consolidating these local profiles.</label>
        </div> : null}
        <button style={styles.primaryButton} type="button" onClick={continueOnDevice} disabled={submitting || (!principalReady && !persistenceError) || (migrationCandidates.length > 1 && !approveLegacyMigration)}>
          {submitting ? 'Preparing…' : 'Continue on this device'}
        </button>
        {error ? <p role="alert" style={styles.error}>{error}</p> : null}
        {persistenceError && !migrationCandidates.length ? <p role="alert" style={styles.error}>Local data is unavailable. Please retry.</p> : null}
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
  deviceLabel: { display: 'grid', gap: '8px', marginBottom: '16px', color: '#4b6357', textAlign: 'left', fontSize: '0.88rem' },
  deviceInput: { border: '1px solid #d4e4d9', borderRadius: '12px', padding: '12px 14px', font: 'inherit' },
  error: { color: '#a32626', fontSize: '0.9rem' },
  migrationNotice: { margin: '0 0 18px', padding: '14px', borderRadius: '14px', background: '#fff8e7', color: '#4d4126', textAlign: 'left', fontSize: '0.88rem' },
};
