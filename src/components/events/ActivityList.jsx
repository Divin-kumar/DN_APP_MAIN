import { Check, Circle, RotateCcw, Sparkles } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import SwipeToComplete from '../common/SwipeToComplete';
import { activityStatus, activityStatusLabel } from '../../utils/activityDetail';
import { parseMomentDate } from '../../utils/momentDates';
import './ActivityList.css';

// List cards contain identity and metadata only. Full content lives in Activity Detail.
export default function ActivityList({ eventName = 'This event', activities, allActivities = activities, progressActivities = allActivities,
  showCancelled = false, includeCancelled = false, hasActiveFilters = false, getActivityKey = (activity) => activity.id,
  getEventName, onOpen, onToggleComplete, readOnly = false }) {
  if (!allActivities.length) return hasActiveFilters
    ? <div className="event-activity-filter-empty">No activities match these filters.</div>
    : <div className="event-activity-empty"><span className="event-activity-empty-art"><Sparkles size={21} /><Circle size={8} /></span>
      <strong>A few helpful steps can make this moment easier</strong><p>Activities help you track things to do for {eventName}.</p></div>;
  const activeActivities = progressActivities.filter((activity) => activityStatus(activity) !== 'cancelled');
  const visibleActivities = includeCancelled ? activities : activities.filter((activity) => (activityStatus(activity) === 'cancelled') === showCancelled);
  const completedCount = activeActivities.filter((activity) => activityStatus(activity) === 'completed').length;
  const progress = activeActivities.length ? Math.round(completedCount / activeActivities.length * 100) : 0;
  return <div className="event-activity-content">
    <div className="event-activity-progress" aria-label={`${completedCount} of ${activeActivities.length} active activities complete`}>
      <div><strong>{completedCount} of {activeActivities.length}</strong><span>active steps complete</span></div>
      <span className="event-activity-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></span>
    </div>
    <div className="event-activity-list">
      {!visibleActivities.length ? <div className="event-activity-filter-empty">{includeCancelled || hasActiveFilters ? 'No activities match these filters.' : showCancelled ? 'No cancelled activities.' : activeActivities.length === 0 ? 'All activities are cancelled.' : 'No activities match these filters.'}</div> : visibleActivities.map((activity) => {
        const key = getActivityKey(activity), status = activityStatus(activity);
        const completed = status === 'completed', cancelled = status === 'cancelled';
        let date; try { date = parseMomentDate(activity.date); } catch { /* Safe legacy date. */ }
        const overdue = !completed && !cancelled && date && date < new Date(new Date().setHours(0, 0, 0, 0));
        const dueText = !date ? 'Date to be decided' : overdue
          ? `Past due · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)}`
          : `Due ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)}`;
        // List cards are navigation-first. Full Edit/Cancel/Restore/Delete actions live on Activity Detail.
        const card = <SwipeActionCard key={key} as="article" className={`event-activity-card${readOnly ? ' is-readonly' : ''}${completed ? ' is-complete' : ''}${overdue ? ' is-overdue' : ''}${cancelled ? ' is-cancelled' : ''}`}
          label={activity.title || 'Untitled activity'} menuButton={false}
          onOpen={onOpen ? () => onOpen(activity) : undefined} swipeEnabled={false} otherActions={[]}>
          <div className="event-activity-main"><div className="event-activity-copy">
            <div className="event-activity-title-row"><strong>{activity.title || 'Untitled activity'}</strong>
              <span className={`event-activity-status${completed ? ' complete' : ''}${cancelled ? ' cancelled' : ''}`} aria-label={`Status: ${activityStatusLabel(activity)}`}>{activityStatusLabel(activity)}</span>
            </div>
            <div className="event-activity-context"><span className="event-activity-moment-name">{getEventName ? getEventName(activity) : eventName}</span><i>·</i><span>{dueText}</span></div>
          </div></div>
        </SwipeActionCard>;
        return !readOnly && onToggleComplete && !cancelled ? <SwipeToComplete key={key} label={activity.title || 'Activity'} direction="left"
          actionLabel={completed ? 'Reopen' : 'Complete'} actionIcon={completed ? RotateCcw : Check}
          onComplete={() => onToggleComplete(activity.id, activity)}>{card}</SwipeToComplete> : card;
      })}
    </div>
  </div>;
}
