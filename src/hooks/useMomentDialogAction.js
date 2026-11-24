import { useEffect, useRef, useState } from 'react';
import { scopedRecordActions } from '../services/scopedRecordActions';

// Moment writes can outlive their dialog or session. Only its opener may
// finish the interaction, and a rapid second submission shares the busy state.
export default function useMomentDialogAction() {
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (operation, onSuccess, failureMessage) => {
    if (pending.current) return;
    const context = scopedRecordActions.capture();
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await operation(context);
      if (mounted.current && scopedRecordActions.isCurrent(context)) onSuccess(result);
    } catch {
      if (mounted.current && scopedRecordActions.isCurrent(context)) setError(failureMessage);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { busy, pending, error, clearError: () => setError(''), run };
}
