import { Check, Circle, Pencil, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import SwipeToComplete from '../common/SwipeToComplete';
import { activityStatus, activityStatusLabel } from '../../utils/activityDetail';
import { parseMomentDate } from '../../utils/momentDates';
import { isActivityEditable } from '../../utils/scopedRecordActions';

// List cards contain identity and metadata only. Full content lives in Activity Detail.
export default function ActivityList({ eventName = 'This event', activities, allActivities = activities,
  showCancelled = false, hasActiveFilters = false, getActivityKey = (activity) => activity.id,
  getEventName, onOpen, onDelete, onEdit, onToggleComplete, onToggleCancelled, readOnly = false }) {
  if (!allActivities.length) return hasActiveFilters
    ? <div className="event-activity-filter-empty">No activities match these filters.</div>
    : <div className="event-activity-empty"><span className="event-activity-empty-art"><Sparkles size={21} /><Circle size={8} /></span>
      <strong>A few helpful steps can make this moment easier</strong><p>Activities help you track things to do for {eventName}.</p></div>;
  const activeActivities = allActivities.filter((activity) => activityStatus(activity) !== 'cancelled');
  const visibleActivities = activities.filter((activity) => (activityStatus(activity) === 'cancelled') === showCancelled);
  const completedCount = activeActivities.filter((activity) => activityStatus(activity) === 'completed').length;
  const progress = activeActivities.length ? Math.round(completedCount / activeActivities.length * 100) : 0;
  return <div className="event-activity-content">
    <div className="event-activity-progress" aria-label={`${completedCount} of ${activeActivities.length} active activities complete`}>
      <div><strong>{completedCount} of {activeActivities.length}</strong><span>active steps complete</span></div>
      <span className="event-activity-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></span>
    </div>
    <div className="event-activity-list">
      {!visibleActivities.length ? <div className="event-activity-filter-empty">{showCancelled ? 'No cancelled activities.' : activeActivities.length === 0 ? 'All activities are cancelled.' : 'No activities match these filters.'}</div> : visibleActivities.map((activity) => {
        const key = getActivityKey(activity), status = activityStatus(activity);
        const completed = status === 'completed', cancelled = status === 'cancelled';
        let date; try { date = parseMomentDate(activity.date); } catch { /* Safe legacy date. */ }
        const overdue = !completed && !cancelled && date && date < new Date(new Date().setHours(0, 0, 0, 0));
        const dueText = !date ? 'Date to be decided' : overdue
          ? `Past due · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)}`
          : `Due ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)}`;
        const hasActions = !readOnly && Boolean(onEdit || onToggleComplete || onToggleCancelled || onDelete);
        const card = <SwipeActionCard key={key} as="article" className={`event-activity-card${readOnly ? ' is-readonly' : ''}${completed ? ' is-complete' : ''}${overdue ? ' is-overdue' : ''}${cancelled ? ' is-cancelled' : ''}`}
          label={activity.title || 'Untitled activity'} menuButton={hasActions} menuLabel="Activity options"
          onOpen={onOpen ? () => onOpen(activity) : undefined} swipeEnabled={!readOnly && cancelled && hasActions}
          otherActions={readOnly ? [] : [
            ...(onEdit && isActivityEditable(activity) ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(activity) }] : []),
            ...(onToggleComplete && !cancelled ? [{ label: completed ? 'Reopen' : 'Complete', icon: completed ? RotateCcw : Check, onClick: () => onToggleComplete(activity.id, activity) }] : []),
            ...(onToggleCancelled ? [{ label: cancelled ? 'Restore' : 'Cancel', icon: cancelled ? RotateCcw : XCircle, onClick: () => onToggleCancelled(activity.id, activity) }] : []),
          ]} onDelete={!readOnly && onDelete ? () => onDelete(activity.id, activity) : undefined}>
          <div className="event-activity-main"><div className="event-activity-copy">
            <div className="event-activity-title-row"><strong>{activity.title || 'Untitled activity'}</strong>
              <span className={`event-activity-status${completed ? ' complete' : ''}${cancelled ? ' cancelled' : ''}`}>{completed ? <Check size={12} aria-hidden="true" /> : cancelled ? <XCircle size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{activityStatusLabel(activity)}</span>
              <span className={`event-activity-priority ${activity.priority || 'medium'}`}>{activity.priority || 'medium'}</span>
            </div>
            <div className="event-activity-context"><span>{getEventName ? getEventName(activity) : eventName}</span><i>·</i><span>{dueText}</span></div>
          </div></div>
        </SwipeActionCard>;
        return !readOnly && onToggleComplete && !cancelled ? <SwipeToComplete key={key} label={activity.title || 'Activity'} direction="left"
          actionLabel={completed ? 'Reopen' : 'Complete'} actionIcon={completed ? RotateCcw : Check}
          onComplete={() => onToggleComplete(activity.id, activity)}>{card}</SwipeToComplete> : card;
      })}
    </div>
  </div>;
}
