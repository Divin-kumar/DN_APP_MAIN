/* Compact event cards used by the event list and focus-mode entry point. */
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';

const getBirthdayAge = (value) => {
  if (!value) return null;

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  let age = today.getFullYear() - birthDate.getFullYear();
  if (todayDate < birthdayThisYear) age -= 1;

  return Math.max(age, 0);
};

export default function EventList({ events, selectedId, onSelect, onOpenWorkspace, onEdit, onDelete }) {
  if (!events.length) {
    return (
      <div className="empty-state" style={styles.emptyState}>
        No events yet.
      </div>
    );
  }

  return (
    <div className="history-scroll">
      <div style={styles.list}>
      {events.map((event) => {
        const activities = event.activities || [];
        const isBirthday = String(event.type || '').toLowerCase() === 'birthday';
        const birthdayAge = isBirthday ? getBirthdayAge(event.date) : null;
        return (
          <article
            key={event.id || event.firestoreId}
            className="activity-row event-card"
            style={{
              ...styles.row,
              ...(selectedId === (event.id || event.firestoreId) ? styles.cardActive : {}),
            }}
          >
            <div style={styles.contentRow}>
              <button type="button" onClick={() => onSelect(event)} style={styles.button}>
                <div style={styles.textBlock}>
                  <strong style={styles.eventName}>{event.name}</strong>
                  <div style={styles.meta}><CalendarDays size={15} style={styles.metaIcon} /> {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div style={styles.meta}><span style={styles.metaTag}>🏷</span> {event.type === 'Other' ? event.customType || 'Other' : event.type}</div>
                  {birthdayAge !== null ? <div className="event-age" style={styles.meta}>Age: {birthdayAge} years</div> : null}
                </div>
              </button>

              <div style={styles.actions}>
                {onOpenWorkspace ? <button type="button" onClick={() => onOpenWorkspace(event)} style={styles.openButton} aria-label={`Open ${event.name}`} title="Open workspace">Open</button> : null}
                <button type="button" onClick={() => onEdit(event)} style={styles.iconButton} aria-label={`Edit ${event.name}`} title="Edit event"><Pencil size={17} /></button>
                <button type="button" onClick={() => onDelete(event)} style={styles.iconButtonDanger} aria-label={`Delete ${event.name}`} title="Delete event"><Trash2 size={17} /></button>
              </div>
            </div>

            <div style={styles.stats}>
              <span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
              <span className="event-status">{new Date(event.date) >= new Date() ? 'Upcoming' : 'Past'}</span>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'var(--surface-soft)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '10px 12px',
    color: 'var(--ink)',
    width: '100%',
    boxSizing: 'border-box',
  },
  contentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    width: '100%',
  },
  cardActive: {
    borderColor: '#b7d7c0',
    background: 'var(--primary-soft)',
  },
  button: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'var(--ink)',
    padding: 0,
  },
  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    minWidth: 0,
    width: '100%',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    color: 'var(--ink-soft)',
    fontSize: '0.74rem',
    marginTop: '3px',
    width: '100%',
    textAlign: 'left',
  },
  metaIcon: {
    flexShrink: 0,
  },
  metaTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    lineHeight: 1,
  },
  eventName: {
    display: 'block',
    width: '100%',
    fontSize: '0.96rem',
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: '2px',
    color: '#1f3f35',
    textAlign: 'left',
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--ink-soft)',
    fontSize: '0.76rem',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    width: '110px',
    flexShrink: 0,
  },
  iconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #bfdcc8',
    background: '#f3faf5',
    color: '#2f6d56',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
  },
  openButton: {
    minWidth: '48px',
    height: '30px',
    border: '1px solid #bfdcc8',
    background: '#f3faf5',
    color: '#2f6d56',
    borderRadius: '10px',
    padding: '0 8px',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  iconButtonDanger: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #f0c9c9',
    background: '#fff3f3',
    color: '#d95b5b',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
  },
  emptyState: {
    background: 'var(--surface)',
    border: '1px dashed var(--border)',
    borderRadius: '14px',
    padding: '22px',
    color: 'var(--ink-soft)',
    textAlign: 'center',
  },
};
