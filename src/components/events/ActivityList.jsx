/*
  This component shows all tasks or activities connected to one event.
  Example: "Book hall", "Send invitations", or "Confirm caterer".
  It also shows which costs are linked to each activity and lets the user
  mark things as done, edit them, or delete them.
*/

// Import React's state hook so the component can remember which expense list is currently expanded.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../pages/activities-page.css';

// Import icons used for actions like complete, edit, delete, money, and add.
import { Check, ChevronDown, Circle, Images, IndianRupee, Pencil, Plus, RotateCcw, Sparkles, Trash2, XCircle } from 'lucide-react';
import useSwipeActions from '../../hooks/useSwipeActions';
import { ACTIVITY_PRIORITY_OPTIONS, getActivityPriorityLabel } from '../../utils/codeLists';
import AttachmentStatusBadge from '../attachments/AttachmentStatusBadge';
import { getAttachmentLinkLabel, getAttachmentStatus, getAttachmentTypeLabel } from '../../utils/attachmentStatus.js';

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image preview could not be read.'));
  reader.onerror = () => reject(reader.error || new Error('Image preview could not be read.'));
  reader.readAsDataURL(blob);
});

// Main component. It receives the event name, the list of activities, money connected to each activity,
// and callback functions that tell the parent screen what action the user wants to do.
export default function ActivityList({
  eventName = 'This event',
  activities,
  allActivities = activities,
  showCancelled = false,
  hasActiveFilters = false,
  expensesByActivity = {},
  onDelete,
  onEdit,
  onAddExpense,
  onLinkExpense,
  onToggleComplete,
  onToggleCancelled,
  onAddActivity,
  getAttachmentBlob,
  userId,
  eventId,
  onOpenPhoto,
}) {
  // This state keeps track of which activity's expense list is open.
  // Example: { "activity-123": true } means the user opened the expense panel for one task.
  const [expandedExpenses, setExpandedExpenses] = useState({});
  const [openActivityId, setOpenActivityId] = useState(null);
  const { action, setAction, swipeRootRef, handlePointerDown, handlePointerMove, handlePointerUp, consumeSwipeClick, close } = useSwipeActions({ surfaceSelector: '.event-activity-card' });

  // If there are no tasks in this event, show a friendly empty state instead of an empty list.
  if (!allActivities.length) {
    return (
      // Empty-state box for a clean, encouraging message.
      <div className="event-activity-empty activities-shared-empty">
        {/* Decorative icon area to make the empty state feel friendly and not blank. */}
        <span className="event-activity-empty-art"><Sparkles size={21} /><Circle size={8} /></span>

        {/* This tells the user what kind of help they can add. */}
        <strong>A few helpful steps can make this moment easier</strong>

        {/* Explain the purpose of activities in simple language. */}
        <p>Activities help you track things to do for {eventName}. Keep the plans right here, alongside the moment they belong to.</p>

        {/* If the parent screen passed an add button action, show it. */}
        {onAddActivity ? <button type="button" className="primaryButton event-empty-state-cta" onClick={onAddActivity}><Plus size={15} /> Add the first activity</button> : null}
      </div>
    );
  }

  // Count how many tasks are already completed.
  const activeActivities = allActivities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const visibleActivities = showCancelled
    ? activities.filter((activity) => activity.cancelled || activity.status === 'cancelled')
    : activities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const completedCount = activeActivities.filter((activity) => activity.completed).length;

  // Work out the completion percentage for the progress bar.
  const progress = activeActivities.length ? Math.round((completedCount / activeActivities.length) * 100) : 0;

  // Main UI: the progress summary and list of all activities.
  return (
    <div ref={swipeRootRef} className="event-activity-content">
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
          const activityExpenses = expensesByActivity[activity.id] || [];

          // Add up all linked amounts for this activity.
          const totalSpent = activityExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

          // Convert the string date into a real Date object so we can compare it with today.
          const activityDate = new Date(`${String(activity.date || '').slice(0, 10)}T00:00:00`);

          // Decide if the task is overdue.
          // A task is overdue only if it is not done, has a valid date, and that date is before today.
          const overdue = !activity.completed && !activity.cancelled && activity.status !== 'cancelled' && !Number.isNaN(activityDate.getTime()) && activityDate < new Date(new Date().setHours(0, 0, 0, 0));

          // Build a readable due date label, such as "Due Mon, 12 Sep" or "Past due · 12 Sep".
          const dueText = !activity.date ? 'Date to be decided' : overdue ? `Past due · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(activityDate)}` : `Due ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(activityDate)}`;

          // Check whether the expense panel for this activity is currently open.
          const expensesOpen = Boolean(expandedExpenses[activity.id]);
          const isCancelled = activity.cancelled || activity.status === 'cancelled';
          const priorityValue = ACTIVITY_PRIORITY_OPTIONS.some((option) => option.value === String(activity.priority || '').toLowerCase())
            ? String(activity.priority || '').toLowerCase()
            : 'medium';

          // See whether this activity has any linked expenses at all.
          const hasExpenses = activityExpenses.length > 0;

          // Make a friendly total label showing how many expenses are connected and how much money is spent.
          const expenseLabel = hasExpenses
            ? `${activityExpenses.length} linked ${activityExpenses.length === 1 ? 'expense' : 'expenses'} · ₹${totalSpent.toLocaleString('en-IN')}`
            : '';

          const isDeleteOpen = openActivityId === activity.id && action === 'delete';
          const isOtherOpen = openActivityId === activity.id && action === 'other';
          const isOpen = isDeleteOpen || isOtherOpen;

          return (
            <article
              key={activity.id}
              role="group"
              tabIndex={0}
              aria-label={`${activity.title || 'Untitled activity'}${isOpen ? ', actions shown' : ', swipe left for other actions or right for delete'}`}
              className={`event-activity-card${activity.completed ? ' is-complete' : ''}${overdue ? ' is-overdue' : ''}${isCancelled ? ' is-cancelled' : ''}${isOpen ? ` is-open-${action}` : ''}`}
              onPointerDown={(event) => {
                handlePointerDown(event);
                if (!event.target.closest('button')) {
                  if (openActivityId !== activity.id) close();
                  setOpenActivityId(activity.id);
                } else if (!event.target.closest('.event-activity-actions')) {
                  close();
                  setOpenActivityId(null);
                }
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(event) => {
                if (event.target.closest('button')) return;
                if (consumeSwipeClick(event)) return;
                if (openActivityId === activity.id && action) {
                  close();
                  setOpenActivityId(null);
                } else {
                  setOpenActivityId(activity.id);
                  setAction('other');
                }
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (openActivityId === activity.id && action) {
                    close();
                    setOpenActivityId(null);
                  } else {
                    setOpenActivityId(activity.id);
                    setAction('other');
                  }
                }
              }}
            >
              <div className="event-activity-actions event-activity-actions-other" aria-hidden={!isOtherOpen}>
                {onAddExpense ? <button type="button" className="event-activity-action-expense" tabIndex={isOtherOpen ? 0 : -1} onClick={() => { onAddExpense(activity); close(); }} aria-label={`Add expense to ${activity.title}`}><IndianRupee size={15} /><span>Expense</span></button> : null}
                {onEdit ? <button type="button" className="event-activity-action-edit" tabIndex={isOtherOpen ? 0 : -1} onClick={() => { onEdit(activity); close(); }} aria-label={`Edit ${activity.title}`}><Pencil size={15} /><span>Edit</span></button> : null}
                {onToggleCancelled ? <button type="button" className={`event-activity-action-cancel ${isCancelled ? 'is-restore' : ''}`} tabIndex={isOtherOpen ? 0 : -1} onClick={() => { onToggleCancelled(activity.id); close(); }} aria-label={`${isCancelled ? 'Restore' : 'Cancel'} ${activity.title}`}>
                  {isCancelled ? <RotateCcw size={15} /> : <XCircle size={15} />}<span>{isCancelled ? 'Restore' : 'Cancel'}</span>
                </button> : null}
              </div>
              <div className="event-activity-actions event-activity-actions-delete" aria-hidden={!isDeleteOpen}>
                {onDelete ? <button type="button" className="event-activity-action-delete" tabIndex={isDeleteOpen ? 0 : -1} onClick={() => { onDelete(activity.id); close(); }} aria-label={`Delete ${activity.title}`}><Trash2 size={15} /><span>Delete</span></button> : null}
              </div>

              <div className="event-activity-main">
                {onToggleComplete && !isCancelled ? (
                  <button
                    type="button"
                    className={`event-activity-complete${activity.completed ? ' is-complete' : ''}`}
                    onClick={(event) => { event.stopPropagation(); onToggleComplete(activity.id); }}
                    aria-label={activity.completed ? `Mark ${activity.title} in progress` : `Complete ${activity.title}`}
                    aria-pressed={Boolean(activity.completed)}
                  >
                    {activity.completed ? <Check size={15} strokeWidth={2.5} /> : null}
                  </button>
                ) : <span className="event-activity-complete-static">{activity.completed ? <Check size={14} /> : <Circle size={14} />}</span>}
                <div className="event-activity-copy">
                <div className="event-activity-title-row">
                  {/* Task name or fallback text if the user did not enter one. */}
                  <strong>{activity.title || 'Untitled activity'}</strong>

                  {/* The status text shows whether the task is done, overdue, or still pending. */}
                  <span className={`event-activity-status${activity.completed ? ' complete' : ''}${isCancelled ? ' cancelled' : ''}`}>{isCancelled ? 'Cancelled' : activity.completed ? 'Complete' : overdue ? 'Overdue' : 'To do'}</span>

                  {/* Priority tells how urgent or important the task is. */}
                  <span className={`event-activity-priority ${priorityValue}`}>{getActivityPriorityLabel(priorityValue)}</span>
                </div>

                {/* Show the event name and due date together for context. */}
                <div className="event-activity-context"><span>{eventName}</span><i>·</i><span>{dueText}</span></div>

                {/* If a task has a description, show it below the title. */}
                {activity.description ? <p className="free-text-content">{activity.description}</p> : null}
                {activity.attachments?.length ? <ActivityAttachments attachments={activity.attachments} getAttachmentBlob={getAttachmentBlob} userId={userId} eventId={eventId} eventName={eventName} activityTitle={activity.title || 'Activity'} onOpenPhoto={onOpenPhoto} /> : null}

                {/* If linked expenses exist, show a section with a toggle to expand and collapse them. */}
                {hasExpenses ? (
                  <div className="event-activity-expense-disclosure">
                    <button type="button" className="event-activity-expense-toggle" onClick={() => setExpandedExpenses((current) => ({ ...current, [activity.id]: !current[activity.id] }))} aria-expanded={expensesOpen}>
                      <IndianRupee size={13} /><span>{expenseLabel}</span><ChevronDown size={14} />
                    </button>

                    {/* When the user opens the list, show each linked expense and action buttons. */}
                    {expensesOpen ? (
                      <div className="event-activity-expense-panel">
                        {activityExpenses.map((expense) => <div className="event-activity-expense-row" key={expense.id || expense.firestoreId}><span>{expense.name || expense.description || 'Expense'}</span><strong>₹{Number(expense.amount || 0).toLocaleString('en-IN')}</strong></div>)}

                        {/* Actions inside the expense panel: create new expense or link an existing one. */}
                        <div className="event-activity-expense-actions">
                          {onAddExpense ? <button type="button" onClick={() => onAddExpense(activity)}><Plus size={13} /> Create expense</button> : null}
                          {onLinkExpense ? <button type="button" onClick={() => onLinkExpense(activity)}>Link existing</button> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ActivityAttachments({ attachments, getAttachmentBlob, userId, eventId, eventName, activityTitle, onOpenPhoto }) {
  const photos = attachments.filter((attachment) => getAttachmentTypeLabel(attachment) === 'Image');
  const otherAttachments = attachments.filter((attachment) => getAttachmentTypeLabel(attachment) !== 'Image');
  const renderAttachment = (attachment) => <ActivityAttachment key={attachment.id} attachment={attachment} attachments={attachments} getAttachmentBlob={getAttachmentBlob} userId={userId} eventId={eventId} eventName={eventName} activityTitle={activityTitle} onOpenPhoto={onOpenPhoto} />;

  return <div className="activity-attachments">
    {photos.length ? <section className="activity-photo-gallery" aria-label={`Photo previews linked to ${activityTitle}`}>
      <div className="activity-photo-grid">{photos.map(renderAttachment)}</div>
    </section> : null}
    {otherAttachments.length ? <div className="activity-attachment-links" aria-label="Other attachments linked to this activity">{otherAttachments.map(renderAttachment)}</div> : null}
  </div>;
}

function ActivityAttachment({ attachment, attachments, getAttachmentBlob, userId, eventId, eventName, activityTitle, onOpenPhoto }) {
  const [localUrl, setLocalUrl] = useState('');
  const [localBlob, setLocalBlob] = useState(null);
  const [dataUrlFallback, setDataUrlFallback] = useState('');
  const [dataUrlAttempted, setDataUrlAttempted] = useState(false);
  const [localFileMissing, setLocalFileMissing] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const resolvedAttachment = localUrl
    ? { ...attachment, hasLocalCopy: true }
    : localFileMissing ? { ...attachment, hasLocalCopy: false } : attachment;
  const status = getAttachmentStatus(resolvedAttachment);
  const externalUrl = [attachment.previewReference, attachment.fileReference, attachment.url]
    .find((candidate) => /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(String(candidate || ''))) || '';
  const openUrl = dataUrlFallback || localUrl || externalUrl;
  const linkLabel = getAttachmentLinkLabel(attachment.parentLinks || []);
  const isPhoto = getAttachmentTypeLabel(attachment) === 'Image';
  const activityPhotos = attachments.filter((item) => getAttachmentTypeLabel(item) === 'Image');
  const photoIndex = activityPhotos.findIndex((item) => item.id === attachment.id);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLocalUrl('');
    setLocalBlob(null);
    setDataUrlFallback('');
    setDataUrlAttempted(false);
    setThumbnailFailed(false);
    setLocalFileMissing(false);
    if ((attachment.hasLocalCopy || attachment.availability === 'local-copy') && getAttachmentBlob) {
      void getAttachmentBlob(userId, attachment.id).then((blob) => {
        if (!active) return;
        if (!blob) {
          setLocalFileMissing(true);
          return;
        }
        setLocalBlob(blob);
        try {
          objectUrl = URL.createObjectURL(blob);
          setLocalUrl(objectUrl);
          setLocalFileMissing(false);
        } catch {
          setDataUrlAttempted(true);
          void blobToDataUrl(blob).then((dataUrl) => { if (active) { setDataUrlFallback(dataUrl); setLocalFileMissing(false); } }).catch(() => { if (active) setThumbnailFailed(true); });
        }
      }).catch(() => { if (active) setLocalFileMissing(true); });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.hasLocalCopy, attachment.availability, getAttachmentBlob, userId]);

  if (isPhoto) return <button type="button" className="activity-photo-preview-button" aria-label={`Preview ${attachment.name || 'photo'}`} onClick={() => onOpenPhoto?.(activityPhotos, photoIndex, `${eventName} · ${activityTitle}`)}>
    {openUrl && !thumbnailFailed ? <img src={openUrl} alt="" loading="lazy" onError={() => {
      if (localBlob && !dataUrlAttempted) {
        setDataUrlAttempted(true);
        void blobToDataUrl(localBlob).then((dataUrl) => setDataUrlFallback(dataUrl)).catch(() => setThumbnailFailed(true));
      } else setThumbnailFailed(true);
    }} /> : <span className="activity-photo-preview-fallback"><Images size={22} /><small>{status.value === 'unavailable' ? 'Unavailable' : 'Preview unavailable'}</small></span>}
  </button>;

  return <span className={`activity-attachment-link${isPhoto ? ' is-photo' : ''}`}>
    <span className="activity-attachment-copy"><strong><Link to={`/attachments/${attachment.id}`} state={{ from: `/events/${eventId}/activities` }} onClick={(event) => event.stopPropagation()}>{attachment.name || 'Untitled attachment'}</Link></strong><small>{getAttachmentTypeLabel(attachment)}</small><span className="attachment-relationship-badge">Linked to: {linkLabel}</span></span>
    <AttachmentStatusBadge attachment={resolvedAttachment} small />
    {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer">Open</a> : <span className="activity-attachment-open-unavailable">Unavailable</span>}
  </span>;
}
