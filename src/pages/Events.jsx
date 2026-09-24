import { useEffect, useMemo, useState } from 'react';
import EventForm from '../components/events/EventForm';
import EventList from '../components/events/EventList';
import ActivityList from '../components/events/ActivityList';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';

const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function Events() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loading, loadEvents, addEvent, updateEventItem, deleteEventItem } = useEventStore();
  const { expenses, loadExpenses, addExpense } = useExpenseStore();
  const [focusedId, setFocusedId] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityAmount, setActivityAmount] = useState('');
  const [expenseActivity, setExpenseActivity] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [user, isGuest, loadEvents, loadExpenses]);

  const focusedEvent = useMemo(() => events.find((event) => (event.id || event.firestoreId) === focusedId) || null, [events, focusedId]);
  const eventExpenses = useMemo(() => expenses.filter((expense) => expense.eventId === focusedId), [expenses, focusedId]);
  const actualSpent = eventExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const closeDrawer = () => { setDrawer(null); setEditingEvent(null); setEditingActivity(null); setActivityTitle(''); setActivityDescription(''); setActivityAmount(''); setExpenseActivity(null); setExpenseAmount(''); };
  const openNewEvent = () => { setEditingEvent(null); setDrawer('event'); };
  const openEditEvent = () => { setEditingEvent(focusedEvent); setDrawer('event'); };

  const saveEvent = async (formData) => {
    if (editingEvent) {
      await updateEventItem(user?.uid, isGuest, { ...editingEvent, ...formData, id: editingEvent.id || formData.id, activities: editingEvent.activities || [] });
    } else {
      await addEvent(user?.uid, isGuest, { ...formData, activities: [] });
    }
    closeDrawer();
  };

  const saveActivity = async () => {
    if (!focusedEvent || !activityTitle.trim()) return;
    const activities = focusedEvent.activities || [];
    const next = { id: editingActivity?.id || crypto.randomUUID(), eventId: focusedId, title: activityTitle.trim(), description: activityDescription.trim(), amount: Number(activityAmount || 0), date: editingActivity?.date || focusedEvent.date, completed: false, createdAt: editingActivity?.createdAt || new Date().toISOString() };
    await updateEventItem(user?.uid, isGuest, { ...focusedEvent, activities: editingActivity ? activities.map((item) => item.id === editingActivity.id ? { ...item, ...next } : item) : [...activities, next] });
    closeDrawer();
  };

  const saveExpense = async () => {
    if (!focusedEvent || !expenseActivity || !expenseAmount) return;
    await addExpense(user?.uid, isGuest, { name: expenseActivity.title, amount: Number(expenseAmount), category: 'Event', date: expenseDate, eventId: focusedId, activityId: expenseActivity.id, source: 'event-activity' });
    closeDrawer();
  };

  const removeActivity = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, { ...focusedEvent, activities: (focusedEvent.activities || []).filter((item) => item.id !== activityId) });
  };

  const removeEvent = async (event) => {
    await deleteEventItem(user?.uid, isGuest, event.id || event.firestoreId);
    setFocusedId(null);
  };

  const timeline = focusedEvent ? [
    { date: focusedEvent.createdAt || focusedEvent.date, label: 'Event created' },
    ...(focusedEvent.activities || []).map((activity) => ({ date: activity.createdAt || activity.date, label: `${activity.title} added` })),
    ...eventExpenses.map((expense) => ({ date: expense.createdAt || expense.date, label: `${expense.name} expense added` })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];

  const exportAlbum = (format) => {
    if (!focusedEvent) return;
    const activityText = (focusedEvent.activities || []).map((item) => `<li><strong>${item.title}</strong><br>${item.description || ''}<br>${dateLabel(item.date)}</li>`).join('');
    const timelineText = timeline.map((item) => `<li>${dateLabel(item.date)} - ${item.label}</li>`).join('');
    const html = `<html><head><title>${focusedEvent.name} Memory Album</title></head><body><h1>${focusedEvent.name}</h1><p>${dateLabel(focusedEvent.date)} · ${focusedEvent.type}</p><hr><h2>Summary</h2><p>Total spent: ${currency(actualSpent)}</p><h2>Timeline</h2><ul>${timelineText}</ul><h2>Activities</h2><ul>${activityText}</ul><h2>Notes</h2><p>${focusedEvent.notes || ''}</p></body></html>`;
    if (format === 'pdf') {
      const popup = window.open('', '_blank');
      popup.document.write(html);
      popup.document.close();
      popup.print();
    } else {
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${focusedEvent.name}-memory-album.doc`; link.click(); URL.revokeObjectURL(url);
    }
  };

  if (focusedEvent) {
    return (
      <div className="events-page event-workspace-page" style={styles.page}>
        <div style={styles.workspaceHeader}>
          <button type="button" onClick={() => setFocusedId(null)} style={styles.backButton}>← Back to Events</button>
          <div style={styles.workspaceActions}><button type="button" onClick={openEditEvent} style={styles.secondaryButton}>Edit Event</button><button type="button" onClick={() => exportAlbum('pdf')} style={styles.secondaryButton}>PDF</button><button type="button" onClick={() => exportAlbum('doc')} style={styles.secondaryButton}>Word</button></div>
        </div>
        <header style={styles.workspaceTitle}><span style={styles.eyebrow}>Event workspace</span><h2 style={styles.title}>{focusedEvent.name}</h2><p style={styles.metaText}>{dateLabel(focusedEvent.date)} · {focusedEvent.type}</p></header>
        <div style={styles.summaryGrid}><div style={styles.metric}><span>Activities</span><strong>{focusedEvent.activities?.length || 0}</strong></div><div style={styles.metric}><span>Total planned</span><strong>{currency((focusedEvent.activities || []).reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></div><div style={styles.metric}><span>Total spent</span><strong>{currency(actualSpent)}</strong></div><div style={styles.metric}><span>Remaining</span><strong>{currency((focusedEvent.activities || []).reduce((sum, item) => sum + Number(item.amount || 0), 0) - actualSpent)}</strong></div></div>
        <section className="workspace-panel" style={styles.panel}><div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Activities</h3><button type="button" onClick={() => setDrawer('activity')} style={styles.primaryButton}>+ Add Activity</button></div><ActivityList activities={focusedEvent.activities || []} onEdit={(activity) => { setEditingActivity(activity); setActivityTitle(activity.title); setActivityDescription(activity.description || ''); setActivityAmount(String(activity.amount || '')); setDrawer('activity'); }} onAddExpense={(activity) => { setExpenseActivity(activity); setDrawer('expense'); }} onDelete={removeActivity} /></section>
        <section className="workspace-panel" style={styles.panel}><h3 style={styles.sectionTitle}>Timeline</h3><div className="timeline-list">{timeline.length ? timeline.map((item, index) => <div className="timeline-item" key={`${item.date}-${index}`}><span>{dateLabel(item.date)}</span><strong>{item.label}</strong></div>) : <p style={styles.metaText}>Your event history will appear here.</p>}</div></section>
        {drawer ? <Drawer type={drawer} event={focusedEvent} editingEvent={editingEvent} editingActivity={editingActivity} activityTitle={activityTitle} activityDescription={activityDescription} activityAmount={activityAmount} expenseActivity={expenseActivity} expenseAmount={expenseAmount} expenseDate={expenseDate} setActivityTitle={setActivityTitle} setActivityDescription={setActivityDescription} setActivityAmount={setActivityAmount} setExpenseAmount={setExpenseAmount} setExpenseDate={setExpenseDate} onClose={closeDrawer} onSaveEvent={saveEvent} onSaveActivity={saveActivity} onSaveExpense={saveExpense} /> : null}
      </div>
    );
  }

  return <div className="events-page" style={styles.page}><div style={styles.headerRow}><div><span style={styles.eyebrow}>Planning</span><h2 style={styles.title}>Events</h2><p style={styles.metaText}>Open an event to enter its workspace.</p></div><button type="button" onClick={openNewEvent} style={styles.primaryButton}>+ New Event</button></div><div style={styles.card}><div style={styles.listHeader}><h3 style={styles.sectionTitle}>Your events</h3><span style={styles.count}>{events.length} total</span></div>{loading ? <p style={styles.metaText}>Loading events...</p> : <EventList events={events} selectedId={null} onSelect={(event) => setFocusedId(event.id || event.firestoreId)} onEdit={(event) => { setFocusedId(event.id || event.firestoreId); setEditingEvent(event); setDrawer('event'); }} onDelete={removeEvent} />}</div>{drawer === 'event' ? <Drawer type="event" editingEvent={editingEvent} onClose={closeDrawer} onSaveEvent={saveEvent} /> : null}</div>;
}

function Drawer({ type, editingEvent, editingActivity, activityTitle, activityDescription, activityAmount, expenseActivity, expenseAmount, expenseDate, setActivityTitle, setActivityDescription, setActivityAmount, setExpenseAmount, setExpenseDate, onClose, onSaveEvent, onSaveActivity, onSaveExpense }) {
  const heading = type === 'event' ? (editingEvent?.name || 'New event') : type === 'activity' ? (editingActivity?.title || 'New activity') : expenseActivity?.title;

  return (
    <div className="event-drawer-backdrop" onClick={onClose}>
      <aside className="event-drawer" onClick={(event) => event.stopPropagation()}>
        <div style={styles.detailHeader}>
          <div>
            <span style={styles.eyebrow}>{type === 'event' ? 'Event details' : type === 'activity' ? 'Activity details' : 'Add expense'}</span>
            <h3 style={styles.detailTitle}>{heading}</h3>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>x</button>
        </div>

        {type === 'event' ? (
          <EventForm initialValues={editingEvent} onSubmit={onSaveEvent} onCancel={onClose} submitLabel={editingEvent ? 'Update Event' : 'Save Event'} />
        ) : type === 'activity' ? (
          <div style={styles.formStack}>
            <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Activity title" style={styles.input} />
            <textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} placeholder="Description" style={styles.input} />
            <input type="number" min="0" value={activityAmount} onChange={(event) => setActivityAmount(event.target.value)} placeholder="Planned amount" style={styles.input} />
            <button type="button" onClick={onSaveActivity} style={styles.primaryButton}>Save Activity</button>
          </div>
        ) : (
          <div style={styles.formStack}>
            <div style={styles.linkedContext}>Event and activity are linked automatically.<br /><strong>{expenseActivity?.title}</strong></div>
            <input type="number" min="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="Actual amount" style={styles.input} />
            <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} style={styles.input} />
            <button type="button" onClick={onSaveExpense} style={styles.primaryButton}>Add Expense</button>
          </div>
        )}
      </aside>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px' },
  workspaceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  workspaceActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  workspaceTitle: { padding: '4px 0 2px' },
  eyebrow: { fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6a7d71' },
  title: { margin: '6px 0 0', fontSize: '1.8rem' },
  metaText: { margin: '6px 0 0', color: '#5a6d61' },
  card: { background: '#fff', borderRadius: '18px', border: '1px solid #dfeae3', padding: '18px', boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  count: { color: '#5a6d61', fontSize: '0.82rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
  metric: { background: '#fff', border: '1px solid #dfeae3', borderRadius: '14px', padding: '14px', display: 'grid', gap: '6px' },
  panel: { background: '#fff', border: '1px solid #dfeae3', borderRadius: '16px', padding: '16px' },
  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' },
  sectionTitle: { margin: 0, fontSize: '1.2rem' },
  primaryButton: { border: 'none', borderRadius: '10px', background: '#2d6a4f', color: '#fff', padding: '11px 14px', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { border: '1px solid #d7e3da', borderRadius: '10px', background: '#f3f8f4', color: '#1d3f2c', padding: '9px 12px', fontWeight: 600, cursor: 'pointer' },
  backButton: { border: 'none', background: 'transparent', color: '#1f6f5d', fontWeight: 700, cursor: 'pointer', padding: '8px 0' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' },
  detailTitle: { margin: '4px 0 0', fontSize: '1.4rem' },
  closeButton: { width: '34px', height: '34px', border: '1px solid #d7e3da', borderRadius: '9px', background: '#f4faf5', cursor: 'pointer', fontSize: '1.2rem' },
  input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d7e3da', background: '#fbfdfb', color: '#1d3f2c', resize: 'vertical' },
  formStack: { display: 'grid', gap: '12px' },
  linkedContext: { padding: '12px', borderRadius: '10px', background: '#f3f8f4', color: '#536964', lineHeight: 1.5 },
};
