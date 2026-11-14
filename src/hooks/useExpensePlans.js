import { useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { watchExpensePlans } from '../services/expensePlanService';

export default function useExpensePlans(uid, isGuest, sample) {
  const [plans, setPlans] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!uid && !isGuest) return undefined;
    const context = { uid: uid || null, isGuest, sample };
    let active = true;
    const current = () => {
      const session = useAppStore.getState();
      return active && (session.user?.uid || null) === context.uid && session.isGuest === isGuest
        && getActiveSampleScenario(context.uid) === sample;
    };
    const fail = (error) => { if (current()) setLoadError(error?.message || 'Could not load expense plans.'); };
    let stop;
    try {
      stop = watchExpensePlans(context, () => {
        if (!current()) throw new Error('Expense plan session changed.');
      }, (items) => { setPlans(items); setLoadError(''); }, fail);
    } catch (error) { fail(error); }
    return () => { active = false; stop?.(); };
  }, [uid, isGuest, sample, attempt]);
  const applySavedPlan = (previous, saved) => setPlans((current) => current.flatMap((plan) => {
    if (plan.id !== previous.id || plan.updatedAt !== previous.updatedAt || plan.dueDate !== previous.dueDate) return [plan];
    return saved ? [saved] : [];
  }));
  return { plans, loadError, applySavedPlan, retry: () => setAttempt((value) => value + 1) };
}
