import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import usePersistentListState from './usePersistentListState';
import useConditionFilters from './useConditionFilters';
import { activityConditions, activityEntryConditionRecord } from '../utils/listConditionMigration';
import { ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES } from '../utils/activityListState';
import { projectActivities, selectActivityEntries } from '../utils/activityRecords';
import { resolveActivitySequence } from '../utils/activitySequence';
import { activityDetailPath } from '../utils/activityDetail';
import { resolveSwipeGesture } from '../utils/swipeGestures';
import { scopedRecordActions as records } from '../services/scopedRecordActions';

export default function useActivityNavigation({ scoped, eventId, activityId, disabled }) {
  const location = useLocation(), navigate = useNavigate();
  const [filters] = usePersistentListState('activities', ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES);
  const entries = useMemo(() => projectActivities(scoped.events), [scoped.events]);
  const conditionRecords = useMemo(() => entries.map(activityEntryConditionRecord), [entries]);
  const conditions = useConditionFilters('activities', conditionRecords, usePersistentListState,
    { initialGroup: activityConditions(filters), contextKey: scoped.sample });
  const selected = selectActivityEntries(conditionRecords, { search: filters.search, field: filters.field,
    direction: filters.direction, parentScope: 'all', includeCancelled: true }).filter(conditions.matches);
  const sequence = resolveActivitySequence(entries, selected, location.state?.activitySequence, scoped.scopeIdentity, eventId, activityId);
  const momentReturn = `/events/${encodeURIComponent(eventId)}/activities`;
  const returnTo = location.state?.activityOrigin === momentReturn ? momentReturn : '/activities';
  const context = records.capture();
  const gesture = useRef(null), suppress = useRef(false), frame = useRef(null), navigating = useRef(false);
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);
  const blocked = () => navigating.current || disabled || scoped.pending || scoped.loadError || !records.isCurrent(context)
    || Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"], .activity-cover.is-repositioning'));
  const move = (direction) => {
    const target = direction < 0 ? sequence.previous : sequence.next;
    if (!target || blocked()) return;
    try { records.resolveActivity(context, target[0], target[1]); } catch { return; }
    navigating.current = true;
    navigate(activityDetailPath(...target), { state: { activityPaging: true, activityOrigin: returnTo,
      activitySequence: { scope: scoped.scopeIdentity, ids: sequence.ids,
        ...(location.state?.activitySequence?.momentId === eventId ? { momentId: eventId } : {}) } } });
  };
  return { ...sequence, returnTo, isPaging: Boolean(location.state?.activityPaging), move,
    gestureProps: {
      onPointerDownCapture: (event) => {
        gesture.current = null;
        // A second finger belongs to a photo pinch/browser gesture, never paging.
        if (event.pointerType === 'touch' && !event.isPrimary) return;
        if (blocked() || frame.current || event.button !== 0 || event.clientX < 20 || event.clientX > innerWidth - 20
          || event.target.closest('button, a, input, select, textarea, details, summary, .dn-transaction-card, .dn-attachment-gallery, [contenteditable="true"], [data-swipe-ignore]')) return;
        gesture.current = { x: event.clientX, y: event.clientY, axis: null, pointer: event.pointerId };
      },
      onPointerMoveCapture: (event) => {
        if (gesture.current) gesture.current.axis = resolveSwipeGesture(gesture.current, { x: event.clientX, y: event.clientY }, gesture.current.axis, 64).axis;
      },
      onPointerCancelCapture: () => { gesture.current = null; },
      onPointerUpCapture: (event) => {
        const start = gesture.current; gesture.current = null;
        if (!start || start.pointer !== event.pointerId || blocked() || !window.getSelection()?.isCollapsed) return;
        if (!resolveSwipeGesture(start, { x: event.clientX, y: event.clientY }, start.axis, 64).action) return;
        const direction = event.clientX < start.x ? 1 : -1;
        if (!(direction < 0 ? sequence.previous : sequence.next)) return;
        event.preventDefault(); suppress.current = true;
        // Let the originating click be suppressed before replacing the route.
        frame.current = requestAnimationFrame(() => { frame.current = null; move(direction); });
      },
      onClickCapture: (event) => { if (suppress.current) { suppress.current = false; event.preventDefault(); event.stopPropagation(); } },
    } };
}
