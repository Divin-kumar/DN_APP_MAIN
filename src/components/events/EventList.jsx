/* Compact event cards used by the event list and focus-mode entry point. */
export default function EventList({ events, selectedId, onSelect, onEdit, onDelete }) {
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
              <div style={styles.meta}>📅 {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div style={styles.meta}>🏷 {event.type === 'Other' ? event.customType || 'Other' : event.type}</div>
            </div>
            <span style={styles.arrow}>›</span>
          </button>

          <div style={styles.stats}>
            <span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => onEdit(event)} style={styles.editButton}>Edit</button>
            <button type="button" onClick={() => onDelete(event)} style={styles.deleteButton}>Delete</button>
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
    background: '#ffffff',
    border: '1px solid #dfeae3',
    borderRadius: '14px',
    padding: '10px 12px',
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
  arrow: {
    fontSize: '1.5rem',
    color: '#5a6d61',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  editButton: {
    border: '1px solid #d7e3da',
    background: '#f4faf5',
    color: '#1d3f2c',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  deleteButton: {
    border: 'none',
    background: '#d9534f',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px 10px',
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
