import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Flag, ListChecks, Pencil, RotateCcw, XCircle } from 'lucide-react';
import useScopedMoments from '../../hooks/useScopedMoments';
import useActivityActions from '../../hooks/useActivityActions';
import useActivityNavigation from '../../hooks/useActivityNavigation';
import RichText from '../../components/common/RichText';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import SwipeActionCard from '../../components/common/SwipeActionCard';
import ActivityActionDialogs from '../../components/events/ActivityActionDialogs';
import LinkedTransactions from '../finance/components/LinkedTransactions';
import ActivityCover from './components/ActivityCover';
import ActivityAttachments from './components/ActivityAttachments';
import { activityDateLabel, activityStatus, activityStatusLabel, resolveActivityDetail } from '../../utils/activityDetail';
import { isActivityEditable } from '../../utils/scopedRecordActions';
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
  const [coverEditing, setCoverEditing] = useState(false);
  const heading = useRef(null);
  const navigation = useActivityNavigation({ scoped, eventId, activityId, disabled: actions.busy || Boolean(actions.draft || actions.deleteTarget) || coverEditing });
  useEffect(() => { if (navigation.isPaging) heading.current?.focus({ preventScroll: true }); }, [navigation.isPaging]);
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
  const parentTo = `/events/${encodeURIComponent(eventId)}/activities`;
  const menuActions = [
    status === 'cancelled'
      ? { label: 'Restore', icon: RotateCcw, onClick: () => actions.setCancelled(target, false) }
      : { label: status === 'completed' ? 'Reopen' : 'Close', icon: status === 'completed' ? RotateCcw : Check,
          disabled: status !== 'completed' && (moment.archived || ['archived', 'cancelled'].includes(moment.status)),
          onClick: () => actions.setCompleted(target, status !== 'completed') },
    ...(isActivityEditable(activity) ? [{ label: 'Edit', icon: Pencil, onClick: () => actions.edit(target) }] : []),
    ...(status !== 'cancelled' ? [{ label: 'Cancel', icon: XCircle, onClick: () => actions.setCancelled(target, true) }] : []),
  ];
  const dates = [
    { label: 'Created', value: activityDateLabel(activity.createdAt, '') },
    { label: 'Completed', value: activityDateLabel(activity.completedAt, '') },
  ].filter(({ value }) => value);
  return <article className="activity-detail-page" {...navigation.gestureProps}>
    <ActivityCover moment={moment} activityId={activityId} uid={scoped.uid} isGuest={scoped.isGuest} backTo={parentTo}
      preferenceKey={`activity-cover:${JSON.stringify([scoped.sample, eventId, activityId])}`} onEditingChange={setCoverEditing} />
    <div className="activity-detail-content">
      <header className="activity-detail-heading">
        <nav className="activity-parent-context" aria-label="Activity parent">Moment: <Link to={parentTo}>{moment.name || 'Untitled Moment'}</Link></nav>
        <span className="activity-title-divider" aria-hidden="true"> — </span><h1 ref={heading} tabIndex={-1}>{activity.title || 'Untitled activity'}</h1>
      </header>
      {moment.archived ? <p className="activity-archived"><Archive size={14} aria-hidden="true" /> Archived Moment</p> : null}
      <div className="activity-detail-metadata" aria-busy={actions.busy}>
        <div className="activity-detail-facts">
          <span className={`activity-status-pill status-${status}`}><StatusIcon size={14} aria-hidden="true" />{activityStatusLabel(activity)}</span>
          <span><CalendarDays size={14} aria-hidden="true" />{activityDateLabel(activity.date)}</span>
          <span className="activity-detail-priority" aria-label={`Priority: ${activity.priority || 'medium'}`}><Flag size={14} aria-hidden="true" />{activity.priority || 'medium'}</span>
        </div>
        <SwipeActionCard as="div" className="activity-detail-more" label={activity.title || 'Activity'} menuButton menuLabel="Activity options" swipeEnabled={false} disabled={actions.busy}
          otherActions={menuActions}
          onDelete={() => actions.requestDelete(target)} />
      </div>
      {actions.error && !actions.draft && !actions.deleteTarget ? <p className="quick-create-error" role="alert">{actions.error}</p> : null}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{actions.announcement}</p>
      {activity.description ? <section className="activity-detail-section" aria-labelledby="activity-description-heading">
        <h2 className="sr-only" id="activity-description-heading">Description</h2>
        <RichText value={activity.description} headingLevel={3} className="activity-description" />
      </section> : null}
      <section className="activity-detail-section" aria-labelledby="activity-transactions-heading">
        <h2 className="sr-only" id="activity-transactions-heading">Transactions</h2><LinkedTransactions eventId={eventId} activityId={activityId} minimal />
      </section>
      <section className="activity-detail-section"><ActivityAttachments moment={moment} activityId={activityId} uid={scoped.uid} isGuest={scoped.isGuest} /></section>
      {navigation.index >= 0 && navigation.ids.length > 1 ? <nav className="activity-pagination" aria-label="Activity navigation">
        <button type="button" className="dn-record-menu-trigger" aria-label="Previous activity" disabled={!navigation.previous || coverEditing || actions.busy} onClick={() => navigation.move(-1)}><ChevronLeft size={19} aria-hidden="true" /></button>
        <span aria-label={`Activity ${navigation.index + 1} of ${navigation.ids.length}`}>{navigation.index + 1} / {navigation.ids.length}</span>
        <button type="button" className="dn-record-menu-trigger" aria-label="Next activity" disabled={!navigation.next || coverEditing || actions.busy} onClick={() => navigation.move(1)}><ChevronRight size={19} aria-hidden="true" /></button>
      </nav> : null}
      {dates.length ? <footer className="activity-detail-footer activity-secondary">
        <dl className="activity-secondary-metadata">{dates.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </footer> : null}
    </div>
    <ActivityActionDialogs actions={actions} onDeleted={() => navigate('/activities', { replace: true })} />
  </article>;
}
