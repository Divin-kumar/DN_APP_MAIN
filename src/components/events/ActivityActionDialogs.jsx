import { AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/useAppStore';
import useEventStore from '../../store/useEventStore';
import { recordId } from '../../utils/recordIdentity';
import DashboardActivityEditor from '../../features/dashboard/components/DashboardActivityEditor';
import { ConfirmDialog } from '../common/ModalDialog';

export default function ActivityActionDialogs({ actions, onDeleted, fallbackFocusRef }) {
  const priorities = useAppStore((state) => state.adminValues.activityPriorities);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes);
  const moments = useEventStore((state) => state.events);
  const moment = moments.find((item) => (recordId(item.id) || recordId(item.firestoreId)) === recordId(actions.draft?.momentId));
  return <>
    <AnimatePresence initial={false}>
      {actions.draft ? <DashboardActivityEditor key="activity-editor" draft={actions.draft} moment={moment} momentTypes={momentTypes} priorities={priorities}
        busy={actions.busy} error={actions.error} fallbackFocusRef={fallbackFocusRef} onChange={actions.changeDraft}
        onSubmit={actions.save} onClose={actions.closeEditor} /> : null}
    </AnimatePresence>
    {actions.deleteTarget ? <ConfirmDialog title="Delete activity?" busyLabel="Deleting…" fallbackFocusRef={fallbackFocusRef}
      message="Delete this activity? Standalone transactions and original attachment files are retained. This cannot be undone."
      busy={actions.busy} error={actions.error} onCancel={actions.closeDelete} onConfirm={() => actions.remove(onDeleted)} /> : null}
  </>;
}
