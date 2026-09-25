/* Compact event cards used by the event list and focus-mode entry point. */
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';

const getBirthdayAge = (value) => {
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (today < birthdayThisYear) age -= 1;
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
      {events.map((event) => (
        (() => {
          const activities = event.activities || [];
          const isBirthday = String(event.type || '').toLowerCase() === 'birthday';
          const birthdayAge = isBirthday ? getBirthdayAge(event.date) : null;
          return (
        <div
          key={event.id || event.firestoreId}
          className="event-card"
          style={{
            ...styles.card,
            ...(selectedId === (event.id || event.firestoreId) ? styles.cardActive : {}),
          }}
        >
          <button type="button" onClick={() => onSelect(event)} style={styles.button}>
            <div>
              <strong style={styles.eventName}>{event.name}</strong>
              <div style={styles.meta}><CalendarDays size={13} /> {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div style={styles.meta}>🏷 {event.type === 'Other' ? event.customType || 'Other' : event.type}</div>
              {birthdayAge !== null ? <div className="event-age" style={styles.meta}>Age: {birthdayAge} years</div> : null}
            </div>
          </button>

          <div style={styles.stats}>
            <span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
            <span className="event-status">{new Date(event.date) >= new Date() ? 'Upcoming' : 'Past'}</span>
          </div>

          <div style={styles.actions}>
            {onOpenWorkspace ? <button type="button" onClick={() => onOpenWorkspace(event)} style={styles.openButton} aria-label={`Open ${event.name}`} title="Open workspace">Open</button> : null}
            <button type="button" onClick={() => onEdit(event)} style={styles.iconButton} aria-label={`Edit ${event.name}`} title="Edit event"><Pencil size={15} /></button>
            <button type="button" onClick={() => onDelete(event)} style={styles.iconButtonDanger} aria-label={`Delete ${event.name}`} title="Delete event"><Trash2 size={15} /></button>
          </div>
        </div>
          );
        })()
      ))}
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
  card: {
    position: 'relative',
    background: '#ffffff',
    border: '1px solid #dfeae3',
    borderRadius: '14px',
    padding: '12px 124px 12px 12px',
  },
  cardActive: {
    borderColor: '#b7d7c0',
    background: '#f2fbf5',
  },
  button: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'left',
    cursor: 'pointer',
    color: '#1d3f2c',
    padding: 0,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: '#5a6d61',
    fontSize: '0.8rem',
    marginTop: '4px',
  },
  eventName: {
    fontSize: '1rem',
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px',
    color: '#536964',
    fontSize: '0.76rem',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    position: 'absolute',
    top: '12px',
    right: '12px',
  },
  editButton: {
    border: '1px solid #d7e3da',
    background: '#f4faf5',
    color: '#1d3f2c',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  workspaceButton: {
    border: '1px solid #b7d7c0',
    background: '#eaf5f0',
    color: '#1f6f5d',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  deleteButton: {
    border: 'none',
    background: '#d9534f',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  iconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #dfeae3',
    background: '#ffffff',
    color: '#536964',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
  },
  openButton: {
    minWidth: '48px',
    height: '32px',
    border: '1px solid #c7ddd1',
    background: '#edf6f1',
    color: '#356653',
    borderRadius: '10px',
    padding: '0 9px',
    cursor: 'pointer',
    fontSize: '0.76rem',
    fontWeight: 700,
  },
  iconButtonDanger: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #ebcaca',
    background: '#fff5f5',
    color: '#b76060',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
  },
  emptyState: {
    background: '#ffffff',
    border: '1px dashed #dfeae3',
    borderRadius: '14px',
    padding: '22px',
    color: '#5a6d61',
    textAlign: 'center',
  },
};
