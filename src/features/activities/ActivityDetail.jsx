import { activityTime } from '../../utils/activityTime.js';
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
import ActivityEntryTimeline from './components/ActivityEntryTimeline';
import { entryCount, ENTRY_MODES } from '../../utils/activityEntries';
import { activityDateLabel, activityDetailPath, activityStatus, activityStatusLabel, resolveActivityDetail } from '../../utils/activityDetail';
import { recordId } from '../../utils/recordIdentity';
import { getActivityMomentType } from '../../utils/activityRecords';
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
  const canonicalId = recordId(found?.activity?.id);
  // An old saved link to a merged Diary or Journal Activity remains usable.
  useEffect(() => {
    if (canonicalId && canonicalId !== recordId(activityId)) {
      navigate(activityDetailPath(eventId, canonicalId), { replace: true });
    }
  }, [canonicalId, activityId, eventId, navigate]);
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
  const target = { momentId: eventId, activityId: recordId(activity.id) };
  const status = activityStatus(activity);
  const StatusIcon = status === 'completed' ? Check : status === 'cancelled' ? XCircle : Circle;
  const parentTo = navigation.returnTo;
  const isDaily = activity.entryMode === ENTRY_MODES.DAILY;
  const menuActions = [
    ...(!isDaily ? [status === 'cancelled'
      ? { label: 'Restore', icon: RotateCcw, onClick: () => actions.setCancelled(target, false) }
      : { label: status === 'completed' ? 'Reopen' : 'Close', icon: status === 'completed' ? RotateCcw : Check,
          disabled: status !== 'completed' && (moment.archived || ['archived', 'cancelled'].includes(moment.status)),
          onClick: () => actions.setCompleted(target, status !== 'completed') },
    ...(isActivityEditable(activity) ? [{ label: 'Edit', icon: Pencil, onClick: () => actions.edit(target) }] : []),
    ...(status !== 'cancelled' ? [{ label: 'Cancel', icon: XCircle, onClick: () => actions.setCancelled(target, true) }] : [])] : []),
  ];
  const dates = [
    { label: 'Created', value: activityDateLabel(activity.createdAt, '') },
    { label: 'Completed', value: activityDateLabel(activity.completedAt, '') },
  ].filter(({ value }) => value);
  return <article className="activity-detail-page" {...navigation.gestureProps}>
    <ActivityCover moment={moment} activityId={activityId} uid={scoped.uid} isGuest={scoped.isGuest}
      backTo={parentTo} backLabel={parentTo === '/activities' ? 'Back to Activities' : 'Back to Moment activities'}
      preferenceKey={`activity-cover:${JSON.stringify([scoped.sample, eventId, activityId])}`} onEditingChange={setCoverEditing} />
    <div className="activity-detail-content">
      <header className="activity-detail-heading">
        <nav className="activity-parent-context" aria-label="Parent Moment">
          <span className="activity-parent-context-type">{getActivityMomentType(moment)}</span>
          <ChevronRight size={14} aria-hidden="true" />
          <Link className="activity-parent-context-link" to={`/events/${encodeURIComponent(eventId)}/activities`}
            title={moment.name || 'Untitled Moment'}><span>{moment.name || 'Untitled Moment'}</span></Link>
        </nav>
        <h1 ref={heading} tabIndex={-1}>{activity.title || 'Untitled activity'}</h1>
      </header>
      {moment.archived ? <p className="activity-archived"><Archive size={14} aria-hidden="true" /> Archived Moment</p> : null}
      <div className="activity-detail-metadata" aria-busy={actions.busy}>
        <div className="activity-detail-facts">
          <span className={`activity-status-pill status-${status}`}><StatusIcon size={13} aria-hidden="true" />{isDaily ? `${entryCount(activity)} entries` : activityStatusLabel(activity)}</span>
          <span className="activity-detail-priority" aria-label={`Priority: ${activity.priority || 'medium'}`}><Flag size={13} aria-hidden="true" />{activity.priority || 'medium'}</span>
        </div>
        <SwipeActionCard as="div" className="activity-detail-more" label={activity.title || 'Activity'} menuButton menuLabel="Activity options" swipeEnabled={false} disabled={actions.busy}
          otherActions={menuActions}
          onDelete={() => actions.requestDelete(target)} />
      </div>
      <p className="activity-detail-due"><CalendarDays size={13} aria-hidden="true" />{activityDateLabel(activity.date)}{activityTime(activity) ? ` · ${activityTime(activity)}` : ''}</p>
      {actions.error && !actions.draft && !actions.deleteTarget ? <p className="quick-create-error" role="alert">{actions.error}</p> : null}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{actions.announcement}</p>
      {activity.description ? <section className="activity-detail-section" aria-labelledby="activity-description-heading">
        <h2 className="sr-only" id="activity-description-heading">Description</h2>
        <RichText value={activity.description} headingLevel={3} className="activity-description" />
      </section> : null}
      <ActivityEntryTimeline activity={activity} actions={actions} target={target} />
      {Array.isArray(activity.linkedJournalActivityIds) && moment.activities.some((item) =>
        activity.linkedJournalActivityIds.some((id) => recordId(id) === recordId(item.id))) ? (
        <section className="activity-detail-section dn-linked-journal-memories" aria-label="Linked Journal memories">
          <h2>Related Journal memories</h2>
          <div className="dn-linked-journal-list">
            {moment.activities.filter((item) => activity.linkedJournalActivityIds.some((id) =>
              recordId(id) === recordId(item.id)) && recordId(item.id) !== recordId(activity.id))
              .map((item) => <Link key={recordId(item.id)} to={activityDetailPath(eventId, recordId(item.id))}>
                {item.title || 'Untitled memory'} <ChevronRight size={16} aria-hidden="true" />
              </Link>)}
          </div>
        </section>
      ) : null}
      <LinkedTransactions eventId={eventId} activityId={activityId} minimal />
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
    <ActivityActionDialogs actions={actions} onDeleted={() => navigate(parentTo, { replace: true })} />
  </article>;
}
