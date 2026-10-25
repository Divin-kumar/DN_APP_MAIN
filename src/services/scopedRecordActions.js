import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { createScopedRecordActions } from '../utils/scopedRecordActions';

export const scopedRecordActions = createScopedRecordActions({
  getSession: useAppStore.getState, getEvents: useEventStore.getState, getSample: getActiveSampleScenario,
});
