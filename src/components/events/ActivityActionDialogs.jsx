import useAppStore from '../../store/useAppStore';
import DashboardActivityEditor from '../../features/dashboard/components/DashboardActivityEditor';
import { ConfirmDialog } from '../common/ModalDialog';

export default function ActivityActionDialogs({ actions, onDeleted }) {
  const priorities = useAppStore((state) => state.adminValues.activityPriorities);
  return <>
    {actions.draft ? <DashboardActivityEditor draft={actions.draft} priorities={priorities}
      busy={actions.busy} error={actions.error} onChange={actions.changeDraft}
      onSubmit={actions.save} onClose={actions.closeEditor} /> : null}
    {actions.deleteTarget ? <ConfirmDialog title="Delete activity?"
      message="Delete this activity? Standalone transactions and original attachment files are retained. This cannot be undone."
      busy={actions.busy} error={actions.error} onCancel={actions.closeDelete} onConfirm={() => actions.remove(onDeleted)} /> : null}
  </>;
}
