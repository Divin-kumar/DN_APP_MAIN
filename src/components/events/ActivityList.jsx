/* Activity cards render event items and their independently linked expenses. */
import { useState } from 'react';
import { Check, ChevronDown, Circle, IndianRupee, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';

export default function ActivityList({ eventName = 'This event', activities, expensesByActivity = {}, onDelete, onEdit, onAddExpense, onLinkExpense, onToggleComplete, onAddActivity }) {
  const [expandedExpenses, setExpandedExpenses] = useState({});
  if (!activities.length) {
    return (
      <div className="event-activity-empty">
        <span className="event-activity-empty-art"><Sparkles size={21} /><Circle size={8} /></span>
        <strong>A few helpful steps can make this moment easier</strong>
        <p>Activities help you track things to do for {eventName}. Keep the plans right here, alongside the moment they belong to.</p>
        {onAddActivity ? <button type="button" className="primaryButton event-empty-state-cta" onClick={onAddActivity}><Plus size={15} /> Add the first activity</button> : null}
      </div>
    );
  }

  const completedCount = activities.filter((activity) => activity.completed).length;
  const progress = Math.round((completedCount / activities.length) * 100);

  return (
    <div className="event-activity-content">
      <div className="event-activity-progress" aria-label={`${completedCount} of ${activities.length} activities complete`}>
        <div><strong>{completedCount} of {activities.length}</strong><span>steps complete</span></div>
        <span className="event-activity-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></span>
      </div>

      <div className="event-activity-list">
        {activities.map((activity) => {
          const activityExpenses = expensesByActivity[activity.id] || [];
          const totalSpent = activityExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
          const activityDate = new Date(`${String(activity.date || '').slice(0, 10)}T00:00:00`);
          const overdue = !activity.completed && !Number.isNaN(activityDate.getTime()) && activityDate < new Date(new Date().setHours(0, 0, 0, 0));
          const dueText = !activity.date ? 'Date to be decided' : overdue ? `Past due · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(activityDate)}` : `Due ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(activityDate)}`;
          const expensesOpen = Boolean(expandedExpenses[activity.id]);
          const hasExpenses = activityExpenses.length > 0;
          const expenseLabel = hasExpenses
            ? `${activityExpenses.length} linked ${activityExpenses.length === 1 ? 'expense' : 'expenses'} · ₹${totalSpent.toLocaleString('en-IN')}`
            : '';

          return (
            <article key={activity.id} className={`event-activity-card${activity.completed ? ' is-complete' : ''}${overdue ? ' is-overdue' : ''}`}>
              {onToggleComplete ? (
                <button className="event-activity-complete" type="button" onClick={() => onToggleComplete(activity.id)} aria-label={activity.completed ? `Mark ${activity.title} pending` : `Complete ${activity.title}`} aria-pressed={Boolean(activity.completed)}>
                  {activity.completed ? <Check size={15} strokeWidth={2.5} /> : null}
                </button>
              ) : <span className="event-activity-complete-static">{activity.completed ? <Check size={14} /> : null}</span>}
              <div className="event-activity-copy">
                <div className="event-activity-title-row">
                  <strong>{activity.title || 'Untitled activity'}</strong>
                  <span className={`event-activity-status${activity.completed ? ' complete' : ''}`}>{activity.completed ? 'Complete' : overdue ? 'Overdue' : 'To do'}</span>
                  <span className={`event-activity-priority ${activity.priority || 'medium'}`}>{activity.priority || 'medium'}</span>
                </div>
                <div className="event-activity-context"><span>{eventName}</span><i>·</i><span>{dueText}</span></div>
                {activity.description ? <p>{activity.description}</p> : null}
                {hasExpenses ? (
                  <div className="event-activity-expense-disclosure">
                    <button type="button" className="event-activity-expense-toggle" onClick={() => setExpandedExpenses((current) => ({ ...current, [activity.id]: !current[activity.id] }))} aria-expanded={expensesOpen}>
                      <IndianRupee size={13} /><span>{expenseLabel}</span><ChevronDown size={14} />
                    </button>
                    {expensesOpen ? (
                      <div className="event-activity-expense-panel">
                        {activityExpenses.map((expense) => <div className="event-activity-expense-row" key={expense.id || expense.firestoreId}><span>{expense.name || expense.description || 'Expense'}</span><strong>₹{Number(expense.amount || 0).toLocaleString('en-IN')}</strong></div>)}
                        <div className="event-activity-expense-actions">
                          {onAddExpense ? <button type="button" onClick={() => onAddExpense(activity)}><Plus size={13} /> Create expense</button> : null}
                          {onLinkExpense ? <button type="button" onClick={() => onLinkExpense(activity)}>Link existing</button> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="event-activity-actions">
                {onAddExpense ? <button type="button" onClick={() => onAddExpense(activity)} aria-label={`Add expense to ${activity.title}`} title="Add expense"><IndianRupee size={15} /></button> : null}
                {onEdit ? <button type="button" onClick={() => onEdit(activity)} aria-label={`Edit ${activity.title}`} title="Edit activity"><Pencil size={15} /></button> : null}
                {onDelete ? <button type="button" onClick={() => onDelete(activity.id)} aria-label={`Remove ${activity.title}`} title="Remove activity"><Trash2 size={15} /></button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
