import { activityTime, activityTimePatch } from '../utils/activityTime.js';
import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { activityCancellationPatch, activityCompletionPatch } from '../utils/activityDetail';
import { formatMomentDate, parseMomentDate } from '../utils/momentDates';
import { assertActivityEditable } from '../utils/scopedRecordActions';
import { updateActivityEntry, removeActivityEntry } from '../utils/activityEntries';

// Shared by the detail page and Dashboard. List/workspace forms use the same
// scoped writer, so every entry point serializes changes to a parent Moment.
export default function useActivityActions() {
  const showToast = useAppStore((state) => state.showToast);
  const context = records.capture();
  const mounted = useRef(true);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && records.isCurrent(context);
  const run = async (target, updater, operation, message, after) => {
    if (saving.current || !mounted.current) return false;
    saving.current = true;
    setBusy(true); setError('');
    try {
      const changed = await records.mutateActivity(context, target.momentId, target.activityId, updater, operation);
      if (current()) { if (changed && message) setAnnouncement(message); after?.(changed); }
      return changed;
    } catch (reason) {
      if (current()) {
        setError(reason?.message || 'Could not save this activity. Please try again.');
        showToast('Could not save this activity. Please try again.', 'danger');
      }
      throw reason;
    } finally { saving.current = false; if (current()) setBusy(false); }
  };
  const setCompleted = (target, completed) => run(target, (activity, moment) => activityCompletionPatch(activity, moment, completed),
    completed ? 'complete' : 'reopen', completed ? 'Activity completed' : 'Activity reopened');
  const setCancelled = (target, cancelled) => run(target, (activity) => activityCancellationPatch(activity, cancelled),
  cancelled ? 'cancel' : 'restore', cancelled ? 'Activity cancelled' : 'Activity restored');
  const edit = (target) => {
    if (saving.current) return;
    try {
      const { moment, activity } = records.resolveActivity(context, target.momentId, target.activityId);
      assertActivityEditable(activity);
      setError('');
      setDraft({ ...target, momentName: moment.name, title: activity.title || '',
        time: activityTime(activity), date: formatMomentDate(parseMomentDate(activity.date)), priority: activity.priority || 'medium', description: activity.description || '' });
    } catch (reason) { setError(reason.message); }
  };
  const save = (event) => {
    event.preventDefault();
    if (!draft?.title.trim() || !parseMomentDate(draft.date)) { setError('Enter an activity title and a valid date.'); return; }
    return run(draft, (activity) => ({ title: draft.title.trim(), date: draft.date, ...activityTimePatch(activity, draft.time), description: draft.description, priority: draft.priority }),
      'edit', 'Activity updated', () => setDraft(null)).catch(() => {});
  };
  const saveEntry = (target, entryId, patch) => run(target,
    (activity) => updateActivityEntry(activity, entryId, patch),
    'entry-edit:' + entryId, 'Entry updated');
  const deleteEntry = (target, entryId) => run(target,
    (activity) => removeActivityEntry(activity, entryId),
    'entry-delete:' + entryId, 'Entry removed');
  const closeEditor = () => { if (!saving.current) { setDraft(null); setError(''); } };
  const requestDelete = (target) => { if (!saving.current) { setError(''); setDeleteTarget(target); } };
  const remove = (after) => run(deleteTarget, () => null, 'delete', 'Activity deleted', (changed) => {
    setDeleteTarget(null); if (changed) after?.();
  }).catch(() => {});
  return { busy, error, announcement, draft, deleteTarget, edit, save, closeEditor, requestDelete, remove,
    saveEntry, deleteEntry,
    changeDraft: (patch) => { if (!saving.current) setDraft((value) => ({ ...value, ...patch })); },
    closeDelete: () => { if (!saving.current) setDeleteTarget(null); }, setCompleted, setCancelled };
}
