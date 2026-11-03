import { useCallback, useMemo, useSyncExternalStore } from 'react';
import useAppStore from '../store/useAppStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { readStoryDesign, STORY_DESIGN_EVENT, storyDesignScope } from '../utils/storyDesignPreferences';

const subscribe = (onChange) => {
  window.addEventListener(STORY_DESIGN_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(STORY_DESIGN_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export default function useStoryDesignDefaults() {
  const uid = useAppStore((state) => state.user?.uid || null);
  const isGuest = useAppStore((state) => state.isGuest);
  const sample = Boolean(getActiveSampleScenario(uid));
  const scope = storyDesignScope({ uid, isGuest, sample });
  const snapshot = useCallback(() => {
    if (!scope || typeof window === 'undefined') return '';
    try { return window.localStorage.getItem(scope) || ''; }
    catch { return ''; }
  }, [scope]);
  const stored = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => readStoryDesign(
    typeof window === 'undefined' ? null : window.localStorage,
    { uid, isGuest, sample },
  ), [uid, isGuest, sample, scope, stored]);
}
