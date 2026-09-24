export default function ActivityList({ activities, onDelete, onEdit, onAddExpense }) {
  if (!activities.length) {
    return <div className="empty-state" style={styles.emptyState}>No activities yet for this event.</div>;
  }

  return (
    <div className="history-scroll">
      <div style={styles.list}>
        {activities.map((activity) => (
          <article key={activity.id} className="activity-row" style={styles.row}>
            <div style={styles.activityContent}>
              <strong>{activity.title}</strong>
              {activity.description ? <div className="activity-description" style={styles.description}>{activity.description}</div> : null}
              <div className="activity-meta" style={styles.meta}>📅 {activity.date}</div>
            </div>
            <div style={styles.actions}>
              <button type="button" onClick={() => onAddExpense(activity)} style={styles.expenseButton}>+ Expense</button>
              <button type="button" onClick={() => onEdit(activity)} style={styles.iconButton} aria-label={`Edit ${activity.title}`}>✎</button>
              <button type="button" onClick={() => onDelete(activity.id)} style={styles.iconButton} aria-label={`Remove ${activity.title}`}>×</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', background: '#f8fbf9', border: '1px solid #dfeae3', borderRadius: '12px', padding: '12px 14px' },
  activityContent: { display: 'grid', gap: '4px', minWidth: 0 },
  description: { color: '#405a4d', fontSize: '0.82rem', lineHeight: 1.35 },
  meta: { color: '#5a6d61', fontSize: '0.8rem' },
  actions: { display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 },
  expenseButton: { border: '1px solid #b9d7ca', background: '#edf8f4', color: '#1f6f5d', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.72rem' },
  iconButton: { width: '28px', height: '28px', border: '1px solid #dfeae3', background: '#fff', color: '#536964', borderRadius: '8px', padding: 0, cursor: 'pointer' },
  emptyState: { background: '#fff', border: '1px dashed #dfeae3', borderRadius: '14px', padding: '18px', color: '#5a6d61', textAlign: 'center' },
};
