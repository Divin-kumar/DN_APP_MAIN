/* Events workspace: event focus mode, activity management, linked expenses, and memory export. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from '../components/events/EventForm';
import EventList from '../components/events/EventList';
import ActivityList from '../components/events/ActivityList';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import { ConfirmDialog } from '../components/common/ModalDialog';

const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function Events() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loading, error, loadEvents, addEvent, updateEventItem, deleteEventItem } = useEventStore();
  const { expenses, loadExpenses, addExpense } = useExpenseStore();
  const [focusedId, setFocusedId] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseActivity, setExpenseActivity] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);

  // ============================
  // Workspace data loading
  // ============================
  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [user, isGuest, loadEvents, loadExpenses]);

  const focusedEvent = useMemo(() => events.find((event) => (event.id || event.firestoreId) === focusedId) || null, [events, focusedId]);
  const eventExpenses = useMemo(() => expenses.filter((expense) => expense.eventId === focusedId), [expenses, focusedId]);
  const expensesByActivity = useMemo(() => {
    if (!focusedEvent) return {};

    const merged = {};
    const addExpense = (activityId, expense) => {
      if (!activityId) return;
      if (!merged[activityId]) merged[activityId] = new Map();
      const expenseId = expense.id || expense.firestoreId || `${activityId}-${expense.date}-${expense.amount}-${expense.description}`;
      if (!merged[activityId].has(expenseId)) merged[activityId].set(expenseId, expense);
    };

    eventExpenses.forEach((expense) => addExpense(expense.activityId, expense));
    focusedEvent.activities?.forEach((activity) => {
      activity.expenses?.forEach((expense) => addExpense(activity.id, expense));
    });

    return Object.fromEntries(Object.entries(merged).map(([activityId, records]) => [activityId, [...records.values()]]));
  }, [eventExpenses, focusedEvent]);

  const actualSpent = Object.values(expensesByActivity)
    .flat()
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    + eventExpenses.filter((expense) => !expense.activityId).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  // ============================
  // Drawer and persistence actions
  // ============================
  const closeDrawer = () => {
    setDrawer(null);
    setEditingEvent(null);
    setEditingActivity(null);
    setActivityTitle('');
    setActivityDescription('');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setExpenseActivity(null);
    setExpenseAmount('');
    setExpenseDescription('');
  };
  const openNewEvent = () => { setEditingEvent(null); setDrawer('event'); };
  const openEditEvent = () => { setEditingEvent(focusedEvent); setDrawer('event'); };

  const saveEvent = async (formData) => {
    if (editingEvent) {
      await updateEventItem(user?.uid, isGuest, { ...editingEvent, ...formData, id: editingEvent.id || formData.id, activities: editingEvent.activities || [] });
      closeDrawer();
    } else {
      const savedEvent = await addEvent(user?.uid, isGuest, { ...formData, activities: [] });
      closeDrawer();
      navigate(`/events/${savedEvent.id || savedEvent.firestoreId}`);
    }
  };

  const saveActivity = async () => {
    if (!focusedEvent || !activityTitle.trim()) return;
    const activities = focusedEvent.activities || [];
    const next = {
      id: editingActivity?.id || crypto.randomUUID(),
      eventId: focusedId,
      title: activityTitle.trim(),
      description: activityDescription.trim(),
      date: activityDate || editingActivity?.date || focusedEvent.date,
      completed: false,
      createdAt: editingActivity?.createdAt || new Date().toISOString(),
    };
    await updateEventItem(user?.uid, isGuest, {
      ...focusedEvent,
      activities: editingActivity ? activities.map((item) => item.id === editingActivity.id ? { ...item, ...next } : item) : [...activities, next],
    });
    closeDrawer();
  };

  const saveExpense = async () => {
    if (!focusedEvent || !expenseActivity || !expenseAmount) return;
    // Keep the master expense record and the activity-local history in sync.
    const savedExpense = await addExpense(user?.uid, isGuest, {
      name: expenseActivity.title,
      description: expenseDescription.trim(),
      amount: Number(expenseAmount),
      category: 'Event',
      date: expenseDate,
      eventId: focusedId,
      activityId: expenseActivity.id,
      source: 'event-activity',
    });

    const nestedExpense = {
      id: savedExpense.id || savedExpense.firestoreId || crypto.randomUUID(),
      description: savedExpense.description || expenseDescription.trim(),
      amount: Number(savedExpense.amount || expenseAmount),
      date: savedExpense.date || expenseDate,
      createdAt: savedExpense.createdAt || new Date().toISOString(),
      eventId: focusedId,
      activityId: expenseActivity.id,
    };

    const activities = (focusedEvent.activities || []).map((activity) => (
      activity.id === expenseActivity.id
        ? { ...activity, expenses: [...(activity.expenses || []), nestedExpense] }
        : activity
    ));

    await updateEventItem(user?.uid, isGuest, { ...focusedEvent, activities });
    closeDrawer();
  };

  const removeActivity = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, { ...focusedEvent, activities: (focusedEvent.activities || []).filter((item) => item.id !== activityId) });
    setPendingDeleteActivity(null);
  };

  const toggleActivity = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, {
      ...focusedEvent,
      activities: (focusedEvent.activities || []).map((activity) => (
        activity.id === activityId ? { ...activity, completed: !activity.completed } : activity
      )),
    });
  };

  const removeEvent = async (event) => {
    try {
      await deleteEventItem(user?.uid, isGuest, event.id || event.firestoreId);
      setFocusedId(null);
      setPendingDeleteEvent(null);
    } catch (deleteError) {
      console.error('Event deletion failed:', deleteError);
    }
  };

  // ============================
  // Memory album export
  // ============================
  const exportAlbum = (format) => {
    if (!focusedEvent) return;
    const activityText = (focusedEvent.activities || []).map((item) => `<article class="memory-card"><h2>${item.title}</h2><p class="date">${dateLabel(item.date)}</p><p>${item.description || 'A memory from this event.'}</p><strong>₹${(expensesByActivity[item.id] || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0).toLocaleString('en-IN')} spent</strong></article>`).join('');
    const html = `<html><head><title>${focusedEvent.name} Memory Album</title><style>@page{size:A4;margin:0}body{margin:0;background:#f6efe5;color:#3b2f2a;font-family:Georgia,serif}.page{min-height:100vh;box-sizing:border-box;padding:80px 70px;page-break-after:always;display:flex;flex-direction:column;justify-content:center}.cover{text-align:center;background:linear-gradient(135deg,#f0d8c8,#f8efe4)}h1{font-size:64px;margin:0 0 18px}.kicker{letter-spacing:4px;text-transform:uppercase;color:#9a6d5b}.date{color:#9a6d5b;font-style:italic}.memory-card{background:#fffaf4;border:1px solid #e3cfc0;border-radius:22px;padding:28px;margin:18px 0;box-shadow:0 10px 24px rgba(104,70,51,.08)}.memory-card strong{color:#a6533d}.closing{text-align:center}</style></head><body><section class="page cover"><p class="kicker">A memory to keep</p><h1>${focusedEvent.name}</h1><p>${dateLabel(focusedEvent.date)}</p><p>${focusedEvent.type} · LifeHub Memories</p></section><section class="page"><p class="kicker">Our memories</p><h1>${focusedEvent.name}</h1><p>${focusedEvent.notes || 'A collection of moments, people, and stories from this special day.'}</p><p>${focusedEvent.activities?.length || 0} memories captured</p></section><section class="page"><p class="kicker">The moments</p>${activityText}</section><section class="page closing"><p class="kicker">Until next time</p><h1>${focusedEvent.name}</h1><p>${focusedEvent.activities?.length || 0} activities</p><h2>₹${actualSpent.toLocaleString('en-IN')} spent</h2><p>${focusedEvent.notes || 'Thank you for being part of this memory.'}</p></section></body></html>`;
    if (format === 'pdf') {
      const popup = window.open('', '_blank');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      let printed = false;
      const printPopup = () => {
        if (printed) return;
        printed = true;
        popup.print();
      };
      popup.onload = printPopup;
      window.setTimeout(printPopup, 350);
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
        <div style={styles.summaryGrid}><div style={styles.metric}><span>Activities</span><strong>{focusedEvent.activities?.length || 0}</strong></div><div style={styles.metric}><span>Total spent</span><strong>{currency(actualSpent)}</strong></div></div>
        <section className="workspace-panel" style={styles.panel}><div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Activities</h3><button type="button" onClick={() => { setEditingActivity(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(focusedEvent.date || new Date().toISOString().slice(0, 10)); setDrawer('activity'); }} style={styles.primaryButton}>+ Add Activity</button></div><ActivityList activities={focusedEvent.activities || []} expensesByActivity={expensesByActivity} onEdit={(activity) => { setEditingActivity(activity); setActivityTitle(activity.title); setActivityDescription(activity.description || ''); setActivityDate(activity.date || focusedEvent.date || new Date().toISOString().slice(0, 10)); setDrawer('activity'); }} onAddExpense={(activity) => { setExpenseActivity(activity); setDrawer('expense'); }} onDelete={(activityId) => setPendingDeleteActivity((focusedEvent.activities || []).find((item) => item.id === activityId))} onToggleComplete={toggleActivity} /></section>
        {pendingDeleteActivity ? <ConfirmDialog title="Remove activity?" message={`Remove “${pendingDeleteActivity.title || 'Untitled activity'}” from this event?`} onCancel={() => setPendingDeleteActivity(null)} onConfirm={() => removeActivity(pendingDeleteActivity.id)} /> : null}
        {drawer ? <Drawer type={drawer} event={focusedEvent} editingEvent={editingEvent} editingActivity={editingActivity} activityTitle={activityTitle} activityDescription={activityDescription} activityDate={activityDate} expenseActivity={expenseActivity} expenseAmount={expenseAmount} expenseDescription={expenseDescription} expenseDate={expenseDate} setActivityTitle={setActivityTitle} setActivityDescription={setActivityDescription} setActivityDate={setActivityDate} setExpenseAmount={setExpenseAmount} setExpenseDescription={setExpenseDescription} setExpenseDate={setExpenseDate} onClose={closeDrawer} onSaveEvent={saveEvent} onSaveActivity={saveActivity} onSaveExpense={saveExpense} /> : null}
      </div>
    );
  }

  return <div className="events-page" style={styles.page}><div style={styles.headerRow}><div><span style={styles.eyebrow}>Planning</span><h2 style={styles.title}>Events</h2><p style={styles.metaText}>Open an event to enter its workspace.</p></div><button type="button" onClick={openNewEvent} style={styles.primaryButton}>+ New Event</button></div><div style={styles.card}><div style={styles.listHeader}><h3 style={styles.sectionTitle}>Your events</h3><span style={styles.count}>{events.length} total</span></div>{error ? <p style={styles.errorText}>{error}</p> : null}{loading ? <p style={styles.metaText}>Loading events...</p> : <EventList events={events} selectedId={null} onSelect={(event) => setFocusedId(event.id || event.firestoreId)} onOpenWorkspace={(event) => navigate(`/events/${event.id || event.firestoreId}`)} onEdit={(event) => { setFocusedId(event.id || event.firestoreId); setEditingEvent(event); setDrawer('event'); }} onDelete={(event) => setPendingDeleteEvent(event)} />}</div>{pendingDeleteEvent ? <ConfirmDialog title="Delete event?" message={`Delete “${pendingDeleteEvent.name || 'Untitled event'}” and its activities? This cannot be undone.`} onCancel={() => setPendingDeleteEvent(null)} onConfirm={() => removeEvent(pendingDeleteEvent)} /> : null}{drawer === 'event' ? <Drawer type="event" editingEvent={editingEvent} onClose={closeDrawer} onSaveEvent={saveEvent} /> : null}</div>;
}

function Drawer({ type, editingEvent, editingActivity, activityTitle, activityDescription, activityDate, expenseActivity, expenseAmount, expenseDescription, expenseDate, setActivityTitle, setActivityDescription, setActivityDate, setExpenseAmount, setExpenseDescription, setExpenseDate, onClose, onSaveEvent, onSaveActivity, onSaveExpense }) {
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
            <input type="date" value={activityDate || ''} onChange={(event) => setActivityDate(event.target.value)} style={styles.input} />
            <button type="button" onClick={onSaveActivity} style={styles.primaryButton}>Save Activity</button>
          </div>
        ) : (
          <div style={styles.formStack}>
            <div style={styles.linkedContext}>Event and activity are linked automatically.<br /><strong>{expenseActivity?.title}</strong></div>
            <input type="number" min="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="Actual amount" style={styles.input} />
            <textarea value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="What was this expense for?" style={styles.input} rows={3} />
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
  errorText: { margin: '0 0 12px', padding: '10px 12px', borderRadius: '10px', background: '#fff1f1', color: '#9d3c3c', border: '1px solid #efcaca' },
};
