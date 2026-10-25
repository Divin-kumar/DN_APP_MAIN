/*
  This component shows all tasks or activities connected to one event.
  Example: "Book hall", "Send invitations", or "Confirm caterer".
  It also shows which costs are linked to each activity and lets the user
  mark things as done, edit them, or delete them.
*/

// Import React's state hook so the component can remember which expense list is currently expanded.
import { useState } from 'react';

// Import icons used for actions like complete, edit, delete, money, and add.
import { Check, ChevronDown, Circle, IndianRupee, Pencil, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import SwipeToComplete from '../common/SwipeToComplete';
import { activityStatus, activityStatusLabel } from '../../utils/activityDetail';
import RichText from '../common/RichText';
import { parseMomentDate } from '../../utils/momentDates';

// Main component. It receives the event name, the list of activities, money connected to each activity,
// and callback functions that tell the parent screen what action the user wants to do.
export default function ActivityList({
  eventName = 'This event',
  activities,
  allActivities = activities,
  showCancelled = false,
  hasActiveFilters = false,
  expensesByActivity = {},
  getActivityKey = (activity) => activity.id,
  getEventName,
  renderAttachments,
  onOpen,
  onDelete,
  onEdit,
  onToggleComplete,
  onToggleCancelled,
  readOnly = false,
}) {
  // This state keeps track of which activity's expense list is open.
  // Example: { "activity-123": true } means the user opened the expense panel for one task.
  const [expandedExpenses, setExpandedExpenses] = useState({});

  // If there are no tasks in this event, show a friendly empty state instead of an empty list.
  if (!allActivities.length) {
    if (hasActiveFilters) return <div className="event-activity-filter-empty">No activities match these filters.</div>;
    return (
      // Empty-state box for a clean, encouraging message.
      <div className="event-activity-empty">
        {/* Decorative icon area to make the empty state feel friendly and not blank. */}
        <span className="event-activity-empty-art"><Sparkles size={21} /><Circle size={8} /></span>

        {/* This tells the user what kind of help they can add. */}
        <strong>A few helpful steps can make this moment easier</strong>

        {/* Explain the purpose of activities in simple language. */}
        <p>Activities help you track things to do for {eventName}. Keep the plans right here, alongside the moment they belong to.</p>

      </div>
    );
  }

  // Count how many tasks are already completed.
  const activeActivities = allActivities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const visibleActivities = showCancelled
    ? activities.filter((activity) => activity.cancelled || activity.status === 'cancelled')
    : activities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const completedCount = activeActivities.filter((activity) => activityStatus(activity) === 'completed').length;

  // Work out the completion percentage for the progress bar.
  const progress = activeActivities.length ? Math.round((completedCount / activeActivities.length) * 100) : 0;

  // Main UI: the progress summary and list of all activities.
  return (
    <div className="event-activity-content">
      {/* This summary tells the user how many tasks are done out of total tasks. */}
      <div className="event-activity-progress" aria-label={`${completedCount} of ${activeActivities.length} active activities complete`}>
        <div>
          <strong>{completedCount} of {activeActivities.length}</strong>
          <span>active steps complete</span>
        </div>

        {/* The progress bar visually shows completion percentage. */}
        <span className="event-activity-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></span>
      </div>

      {/* The full list of activities for this event. */}
      <div className="event-activity-list">
        {!visibleActivities.length && (hasActiveFilters || showCancelled || activeActivities.length === 0) ? <div className="event-activity-filter-empty">{showCancelled ? 'No cancelled activities.' : activeActivities.length === 0 ? 'All activities are cancelled.' : 'No activities match these filters.'}</div> : visibleActivities.map((activity) => {
          // Get the expenses that belong to this single activity.
          const activityKey = getActivityKey(activity);
          const activityEventName = getEventName ? getEventName(activity) : eventName;
          const activityExpenses = expensesByActivity[activityKey] || [];
          const isCompleted = activityStatus(activity) === 'completed';

          // Add up all linked amounts for this activity.
          const totalSpent = activityExpenses.reduce((sum, expense) => sum + (Number.isFinite(Number(expense.amount)) ? Number(expense.amount) : 0), 0);

          // Convert the string date into a real Date object so we can compare it with today.
          let activityDate;
          try { activityDate = parseMomentDate(activity.date); } catch { /* Invalid legacy date. */ }

          // Decide if the task is overdue.
          // A task is overdue only if it is not done, has a valid date, and that date is before today.
          const overdue = !isCompleted && !activity.cancelled && activity.status !== 'cancelled' && activityDate && activityDate < new Date(new Date().setHours(0, 0, 0, 0));

          // Build a readable due date label, such as "Due Mon, 12 Sep" or "Past due · 12 Sep".
          const dueText = !activityDate ? 'Date to be decided' : overdue ? `Past due · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(activityDate)}` : `Due ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(activityDate)}`;

          // Check whether the expense panel for this activity is currently open.
          const expensesOpen = Boolean(expandedExpenses[activityKey]);
          const isCancelled = activity.cancelled || activity.status === 'cancelled';
          const hasActions = !readOnly && Boolean(onEdit || onToggleComplete || onToggleCancelled || onDelete);

          // See whether this activity has any linked expenses at all.
          const hasExpenses = activityExpenses.length > 0;

          // Make a friendly total label showing how many expenses are connected and how much money is spent.
          const expenseLabel = hasExpenses
            ? `${activityExpenses.length} linked ${activityExpenses.length === 1 ? 'expense' : 'expenses'} · ₹${totalSpent.toLocaleString('en-IN')}`
            : '';

          const card = (
            <SwipeActionCard key={activityKey} as="article"
              className={`event-activity-card${readOnly ? ' is-readonly' : ''}${isCompleted ? ' is-complete' : ''}${overdue ? ' is-overdue' : ''}${isCancelled ? ' is-cancelled' : ''}`}
              label={activity.title || 'Untitled activity'} menuButton={hasActions} menuLabel="Activity options"
              onOpen={onOpen ? () => onOpen(activity) : undefined} swipeEnabled={!readOnly && isCancelled && hasActions}
              otherActions={readOnly ? [] : [
                ...(onEdit ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(activity) }] : []),
                ...(onToggleComplete && !isCancelled ? [{ label: isCompleted ? 'Reopen' : 'Complete',
                  icon: isCompleted ? RotateCcw : Check, onClick: () => onToggleComplete(activity.id, activity) }] : []),
                ...(onToggleCancelled ? [{ label: isCancelled ? 'Restore' : 'Cancel', icon: isCancelled ? RotateCcw : XCircle,
                  onClick: () => onToggleCancelled(activity.id, activity) }] : []),
              ]}
              onDelete={!readOnly && onDelete ? () => onDelete(activity.id, activity) : undefined}>
              <div className="event-activity-main">
                <div className="event-activity-copy">
                <div className="event-activity-title-row">
                  {/* Task name or fallback text if the user did not enter one. */}
                  <strong>{activity.title || 'Untitled activity'}</strong>

                  {/* The status text shows whether the task is done, overdue, or still pending. */}
                  <span className={`event-activity-status${isCompleted ? ' complete' : ''}${isCancelled ? ' cancelled' : ''}`}>{isCompleted ? <Check size={12} aria-hidden="true" /> : isCancelled ? <XCircle size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{activityStatusLabel(activity)}</span>

                  {/* Priority tells how urgent or important the task is. */}
                  <span className={`event-activity-priority ${activity.priority || 'medium'}`}>{activity.priority || 'medium'}</span>
                </div>

                {/* Show the event name and due date together for context. */}
                <div className="event-activity-context"><span>{activityEventName}</span><i>·</i><span>{dueText}</span></div>

                {/* If a task has a description, show it below the title. */}
                {activity.description ? <RichText value={activity.description} /> : null}
                {renderAttachments?.(activity)}

                {/* If linked expenses exist, show a section with a toggle to expand and collapse them. */}
                {hasExpenses ? (
                  <div className="event-activity-expense-disclosure">
                    <button type="button" className="event-activity-expense-toggle" onClick={() => setExpandedExpenses((current) => ({ ...current, [activityKey]: !current[activityKey] }))} aria-expanded={expensesOpen}>
                      <IndianRupee size={13} /><span>{expenseLabel}</span><ChevronDown size={14} />
                    </button>

                    {/* When the user opens the list, show each linked expense and action buttons. */}
                    {expensesOpen ? (
                      <div className="event-activity-expense-panel">
                        {activityExpenses.map((expense) => <div className="event-activity-expense-row" key={expense.id || expense.firestoreId}><span>{expense.name || expense.description || 'Expense'}</span><strong>₹{Number(expense.amount || 0).toLocaleString('en-IN')}</strong></div>)}

                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              </div>
            </SwipeActionCard>
          );
          return !readOnly && onToggleComplete && !isCancelled ? <SwipeToComplete key={activityKey} label={activity.title || 'Activity'}
            direction="left" actionLabel={isCompleted ? 'Reopen' : 'Complete'} actionIcon={isCompleted ? RotateCcw : Check}
            onComplete={() => onToggleComplete(activity.id, activity)}>{card}</SwipeToComplete> : card;
        })}
      </div>
    </div>
  );
}
