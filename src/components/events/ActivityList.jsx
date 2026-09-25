/* Activity cards render event items and their independently linked expenses. */
import { Check, Pencil, ReceiptText, Trash2 } from 'lucide-react';

export default function ActivityList({ activities, expensesByActivity = {}, onDelete, onEdit, onAddExpense, onToggleComplete }) {
  if (!activities.length) {
    return <div className="empty-state" style={styles.emptyState}>No activities yet for this event.</div>;
  }

  return (
    <div className="history-scroll">
      <div style={styles.list}>
        {activities.map((activity) => {
          // Merge nested history with legacy master records without duplicating IDs.
          const activityExpenses = expensesByActivity[activity.id] || [];

          return (
          <article key={activity.id} className="activity-row" style={styles.row}>
            <div style={styles.activityContent}>
              <label style={styles.activityTitle}>
                <span className={`activity-check ${activity.completed ? 'activity-check-complete' : ''}`}>
                  {onToggleComplete ? <input type="checkbox" checked={Boolean(activity.completed)} onChange={() => onToggleComplete(activity.id)} aria-label={`Mark ${activity.title} ${activity.completed ? 'active' : 'complete'}`} /> : null}
                  {activity.completed ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                <strong>{activity.title}</strong>
                <span className={`activity-status ${activity.completed ? 'activity-status-complete' : ''}`}>{activity.completed ? 'Complete' : 'Open'}</span>
              </label>
              {activity.description ? <div className="activity-description" style={styles.description}>{activity.description}</div> : null}
              <div className="activity-meta" style={styles.meta}>📅 {activity.date}</div>
              {activityExpenses.length ? (
                <div className="activity-expenses" style={styles.expenses}>
                  {[...activityExpenses]
                    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
                    .map((expense) => (
                      <div key={expense.id || expense.firestoreId} style={styles.expenseRow}>
                        <span>• {expense.description || expense.name}</span>
                        <strong>₹{Number(expense.amount || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    ))}
                </div>
              ) : null}
              <strong className="activity-spent">₹{activityExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0).toLocaleString('en-IN')} spent</strong>
            </div>
            <div style={styles.actions}>
              <button type="button" onClick={() => onAddExpense(activity)} style={styles.iconButton} aria-label={`Add expense to ${activity.title}`} title="Add expense"><ReceiptText size={15} /></button>
              <button type="button" onClick={() => onEdit(activity)} style={styles.iconButton} aria-label={`Edit ${activity.title}`} title="Edit activity"><Pencil size={15} /></button>
              <button type="button" onClick={() => onDelete(activity.id)} style={styles.iconButtonDanger} aria-label={`Remove ${activity.title}`} title="Remove activity"><Trash2 size={15} /></button>
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', background: '#f8fbf9', border: '1px solid #dfeae3', borderRadius: '12px', padding: '12px 14px' },
  activityContent: { display: 'grid', gap: '4px', minWidth: 0 },
  activityTitle: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  description: { color: '#405a4d', fontSize: '0.82rem', lineHeight: 1.35 },
  meta: { color: '#5a6d61', fontSize: '0.8rem' },
  expenses: { display: 'grid', gap: '3px', marginTop: '3px' },
  expenseRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#536964', fontSize: '0.78rem' },
  actions: { display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 },
  expenseButton: { border: '1px solid #b9d7ca', background: '#edf8f4', color: '#1f6f5d', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '0.72rem' },
  iconButton: { display: 'inline-grid', placeItems: 'center', width: '34px', height: '34px', border: '1px solid #dfeae3', background: '#fff', color: '#536964', borderRadius: '10px', padding: 0, cursor: 'pointer' },
  iconButtonDanger: { display: 'inline-grid', placeItems: 'center', width: '34px', height: '34px', border: '1px solid #ebcaca', background: '#fff5f5', color: '#b76060', borderRadius: '10px', padding: 0, cursor: 'pointer' },
  emptyState: { background: '#fff', border: '1px dashed #dfeae3', borderRadius: '14px', padding: '18px', color: '#5a6d61', textAlign: 'center' },
};
