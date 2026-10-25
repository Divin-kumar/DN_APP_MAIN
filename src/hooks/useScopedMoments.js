import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { isRecordScopeLoaded, recordScopeKey } from '../utils/scopedRecordActions';

const EMPTY = Object.freeze([]);
export default function useScopedMoments() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const state = useEventStore();
  const uid = user?.uid;
  const sample = getActiveSampleScenario(uid);
  const scope = recordScopeKey({ user, isGuest });
  const { loadEvents } = state;
  useEffect(() => { if (uid || isGuest) loadEvents(uid, isGuest); }, [uid, isGuest, sample, loadEvents]);
  const ready = isRecordScopeLoaded(state, scope, sample);
  return { ...state, uid, isGuest, sample, scope, scopeIdentity: JSON.stringify([scope, sample]), ready,
    events: ready ? state.events : EMPTY, pending: !ready || state.loading,
    loadError: state.activeLoadKey === scope && state.error === 'Unable to load events.',
    retry: () => loadEvents(uid, isGuest) };
}
