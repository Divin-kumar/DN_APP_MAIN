import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, CalendarDays, Check, Circle, Flag, ListChecks, Pencil, RotateCcw, XCircle } from 'lucide-react';
import useScopedMoments from '../../hooks/useScopedMoments';
import useActivityActions from '../../hooks/useActivityActions';
import RichText from '../../components/common/RichText';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import SwipeActionCard from '../../components/common/SwipeActionCard';
import ActivityActionDialogs from '../../components/events/ActivityActionDialogs';
import LinkedTransactions from '../finance/components/LinkedTransactions';
import ActivityCover from './components/ActivityCover';
import ActivityAttachments from './components/ActivityAttachments';
import { activityAttachments, activityDateLabel, activityStatus, activityStatusLabel, resolveActivityDetail, selectActivityCover } from '../../utils/activityDetail';
import { getActivityMomentType } from '../../utils/activityRecords';
import { financialDate } from '../../utils/financialRecords';
import './ActivityDetail.css';

export default function ActivityDetail() {
  const scoped = useScopedMoments();
  const { eventId, activityId } = useParams();
  return <ActivityDetailContent key={JSON.stringify([scoped.scopeIdentity, eventId, activityId])}
    scoped={scoped} eventId={eventId} activityId={activityId} />;
}

export function ActivityDetailContent({ scoped, eventId, activityId }) {
  const actions = useActivityActions();
  const navigate = useNavigate();
  const found = resolveActivityDetail(scoped.events, eventId, activityId);
  if (scoped.loadError) return <div className="activity-detail-page" role="alert"><h1>Activity couldn’t be loaded</h1>
    <p>Your Moments couldn’t be loaded. Please try again.</p><button type="button" className="secondaryButton" onClick={scoped.retry}>Try again</button></div>;
  if (scoped.pending) return <div className="activity-detail-page activity-detail-skeleton" aria-busy="true">
    <div className="activity-cover is-loading" /><LoadingSkeleton rows={5} label="Loading activity" /></div>;
  if (!found) return <section className="activity-detail-page activity-not-found">
    <ListChecks size={28} aria-hidden="true" /><h1>Activity not found</h1>
    <p>This activity or its parent Moment is unavailable in the current session. It may have been removed.</p>
    <div className="activity-detail-actions"><Link className="primaryButton" to="/activities">Back to Activities</Link><Link className="secondaryButton" to="/dashboard">Dashboard</Link></div>
  </section>;
  const { moment, activity } = found;
  const target = { momentId: eventId, activityId };
  const status = activityStatus(activity);
  const StatusIcon = status === 'completed' ? Check : status === 'cancelled' ? XCircle : Circle;
  const cover = selectActivityCover(moment, activityId);
  const coverKey = JSON.stringify([cover?.id, cover?.assetId, cover?.storage, cover?.url, cover?.downloadURL, cover?.src]);
  const parentTo = `/events/${encodeURIComponent(eventId)}/activities`;
  const perform = (operation) => operation().catch(() => {});
  return <article className="activity-detail-page">
    <ActivityCover key={coverKey} attachment={cover} uid={scoped.uid} isGuest={scoped.isGuest} backTo={parentTo} momentType={getActivityMomentType(moment)} />
    <div className="activity-detail-content">
      <nav className="activity-parent-context" aria-label="Activity parent"><span>Moment</span><Link to={parentTo}>{moment.name || 'Untitled Moment'}</Link></nav>
      {moment.archived ? <p className="activity-archived"><Archive size={14} aria-hidden="true" /> Archived Moment</p> : null}
      <h1>{activity.title || 'Untitled activity'}</h1>
      <div className="activity-detail-metadata">
        <span className={`activity-status-pill status-${status}`}><StatusIcon size={14} aria-hidden="true" />{activityStatusLabel(activity)}</span>
        <span><CalendarDays size={14} aria-hidden="true" />{activityDateLabel(activity.date)}</span>
        <span><Flag size={14} aria-hidden="true" />Priority: {activity.priority || 'medium'}</span>
      </div>
      <div className="activity-detail-actions" aria-busy={actions.busy}>
        {status !== 'cancelled' ? <button type="button" className="primaryButton" disabled={actions.busy || (moment.archived && status !== 'completed')}
          onClick={() => perform(() => actions.setCompleted(target, status !== 'completed'))}>
          {status === 'completed' ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{actions.busy ? 'Saving…' : status === 'completed' ? 'Reopen' : 'Complete'}</button>
          : <button type="button" className="primaryButton" disabled={actions.busy} onClick={() => perform(() => actions.setCancelled(target, false))}><RotateCcw size={16} aria-hidden="true" />Restore</button>}
        <button type="button" className="secondaryButton" disabled={actions.busy} onClick={() => actions.edit(target)}><Pencil size={15} aria-hidden="true" />Edit</button>
        <SwipeActionCard className="activity-detail-more" label={activity.title || 'Activity'} menuButton menuLabel="Activity options" swipeEnabled={false} disabled={actions.busy}
          otherActions={status !== 'cancelled' ? [{ label: 'Cancel', icon: XCircle, onClick: () => perform(() => actions.setCancelled(target, true)) }] : []}
          onDelete={() => actions.requestDelete(target)} />
      </div>
      {actions.error && !actions.draft && !actions.deleteTarget ? <p className="quick-create-error" role="alert">{actions.error}</p> : null}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{actions.announcement}</p>
      <section className="activity-detail-section" aria-labelledby="activity-description-heading"><h2 id="activity-description-heading">Description</h2>
        {activity.description ? <RichText value={activity.description} headingLevel={3} className="activity-description" />
          : <p className="moment-empty-state">No description added. <button type="button" className="moment-text-action" onClick={() => actions.edit(target)}>Edit</button></p>}
      </section>
      <section className="activity-detail-section"><h2>Parent Moment</h2><Link className="activity-parent-link" to={parentTo}>{moment.name || 'Untitled Moment'}</Link>
        <p className="activity-secondary">{getActivityMomentType(moment)} · {activityDateLabel(moment.date)}{moment.archived ? ' · Archived Moment' : ''}</p>
      </section>
      <section className="activity-detail-section"><h2>Finance</h2><LinkedTransactions eventId={eventId} activityId={activityId} date={financialDate(activity.date)} /></section>
      <section className="activity-detail-section"><ActivityAttachments moment={moment} activityId={activityId} uid={scoped.uid} isGuest={scoped.isGuest} /></section>
      <footer className="activity-detail-section activity-secondary">
        <dl className="activity-secondary-metadata"><div><dt>Created</dt><dd>{activityDateLabel(activity.createdAt)}</dd></div>
          {activity.completedAt ? <div><dt>Completed</dt><dd>{activityDateLabel(activity.completedAt)}</dd></div> : null}
          <div><dt>Attachments</dt><dd>{activityAttachments(moment, activityId).length}</dd></div>
        </dl>
        <button type="button" className="activity-delete-action" disabled={actions.busy} onClick={() => actions.requestDelete(target)}>Delete activity</button>
      </footer>
    </div>
    <ActivityActionDialogs actions={actions} onDeleted={() => navigate('/activities', { replace: true })} />
  </article>;
}
