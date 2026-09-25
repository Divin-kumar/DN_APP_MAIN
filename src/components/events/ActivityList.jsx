/* Activity cards render event items and their independently linked expenses. */
import { Check, IndianRupee, Pencil, Trash2 } from 'lucide-react';

export default function ActivityList({ activities, expensesByActivity = {}, onDelete, onEdit, onAddExpense, onToggleComplete }) {
  if (!activities.length) {
    return <div className="empty-state" style={styles.emptyState}>No activities yet for this event.</div>;
  }

  return (
    <div className="history-scroll">
      <div style={styles.list}>
        {activities.map((activity) => {
          const activityExpenses = expensesByActivity[activity.id] || [];
          const totalSpent = activityExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

          return (
            <article key={activity.id} className="activity-row" style={styles.row}>
              <div style={styles.activityContent}>
                <div style={styles.headerRow}>
                  <label style={styles.activityTitle}>
                    <span className={`activity-check ${activity.completed ? 'activity-check-complete' : ''}`}>
                      {onToggleComplete ? <input type="checkbox" checked={Boolean(activity.completed)} onChange={() => onToggleComplete(activity.id)} aria-label={`Mark ${activity.title} ${activity.completed ? 'active' : 'complete'}`} /> : null}
                      {activity.completed ? <Check size={13} strokeWidth={3} /> : null}
                    </span>
                    <strong>{activity.title}</strong>
                    <span className={`activity-status ${activity.completed ? 'activity-status-complete' : ''}`}>{activity.completed ? 'Complete' : 'Open'}</span>
                  </label>
                  <strong className="activity-spent" style={styles.totalSpent}>₹{totalSpent.toLocaleString('en-IN')} spent</strong>
                </div>

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
              </div>

              <div style={styles.actions} className="activity-actions">
                <button type="button" onClick={() => onAddExpense(activity)} style={styles.iconButton} aria-label={`Add expense to ${activity.title}`} title="Add expense"><IndianRupee size={15} /></button>
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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'var(--surface-soft)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '12px 14px',
    color: 'var(--ink)',
    flexWrap: 'wrap',
  },
  activityContent: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', width: '100%' },
  activityTitle: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start' },
  description: { color: 'var(--ink-soft)', fontSize: '0.82rem', lineHeight: 1.35, textAlign: 'left' },
  meta: { color: 'var(--ink-soft)', fontSize: '0.8rem', textAlign: 'left' },
  totalSpent: { color: '#1d5d4a', fontSize: '0.76rem', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' },
  expenses: { display: 'grid', gap: '4px', marginTop: '2px' },
  expenseRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', color: 'var(--ink-soft)', fontSize: '0.78rem', lineHeight: 1.3 },
  actions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', width: '120px', flexShrink: 0 },
  iconButton: { display: 'inline-grid', placeItems: 'center', width: '36px', height: '36px', border: '1px solid #bfdcc8', background: '#f3faf5', color: '#2f6d56', borderRadius: '10px', padding: 0, cursor: 'pointer' },
  iconButtonDanger: { display: 'inline-grid', placeItems: 'center', width: '36px', height: '36px', border: '1px solid #f0c9c9', background: '#fff3f3', color: '#d95b5b', borderRadius: '10px', padding: 0, cursor: 'pointer' },
  emptyState: { background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '14px', padding: '18px', color: 'var(--ink-soft)', textAlign: 'center' },
};
