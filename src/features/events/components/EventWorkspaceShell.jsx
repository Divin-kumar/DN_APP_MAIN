import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookHeart, Clock3, Download, FileText, Images, ListChecks, Pencil, Trash2, Upload } from 'lucide-react';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date to be decided'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EventWorkspaceShell() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loading, error, loadEvents, updateEventItem, deleteEventItem } = useEventStore();
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityDescription, setActivityDescription] = useState('');
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryBody, setMemoryBody] = useState('');
  const [pendingDeleteMemory, setPendingDeleteMemory] = useState(null);
  const [pendingDeleteAttachment, setPendingDeleteAttachment] = useState(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!events.length) loadEvents(user?.uid, isGuest);
  }, [events.length, isGuest, loadEvents, user]);

  const event = events.find((item) => (item.id || item.firestoreId) === eventId);

  if (loading && !event) {
    return <p style={{ color: '#536a5d' }}>Loading event workspace...</p>;
  }

  if (!event) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0 }}>Event not found</h2>
        <p style={{ margin: 0, color: '#536a5d' }}>This event may have been removed or is not available in the current session.</p>
        <Link to="/events" style={{ color: '#1f6f5d', fontWeight: 700 }}>Back to Events</Link>
      </div>
    );
  }

  const sections = [
    { label: 'Overview', path: `/events/${eventId}/overview`, detail: 'Event details and current status', icon: FileText },
    { label: 'Activities', path: `/events/${eventId}/activities`, detail: `${event.activities?.length || 0} activities captured`, icon: ListChecks },
    { label: 'Timeline', path: `/events/${eventId}/timeline`, detail: 'Milestones and progress', icon: Clock3 },
    { label: 'Memories', path: `/events/${eventId}/memories`, detail: `${event.memories?.length || 0} memories saved`, icon: BookHeart },
    { label: 'Attachments', path: `/events/${eventId}/attachments`, detail: `${event.attachments?.length || 0} keepsakes attached`, icon: Images },
    { label: 'PDF Export', path: `/events/${eventId}/pdf`, detail: 'A printable event summary', icon: Download },
  ];
  const activeSection = sections.find((section) => location.pathname === section.path) || sections[0];
  const activities = [...(event.activities || [])].sort((first, second) => (
    new Date(first.date || 0).getTime() - new Date(second.date || 0).getTime()
  ));

  const addActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityTitle.trim()) return;

    const existingActivity = (event.activities || []).find((item) => item.id === editingActivityId);
    const activity = {
      id: editingActivityId || crypto.randomUUID(),
      eventId,
      title: activityTitle.trim(),
      date: activityDate,
      description: activityDescription.trim(),
      completed: existingActivity?.completed || false,
      createdAt: existingActivity?.createdAt || new Date().toISOString(),
    };

    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: editingActivityId
        ? (event.activities || []).map((item) => item.id === editingActivityId ? { ...item, ...activity } : item)
        : [...(event.activities || []), activity],
    });
    setActivityTitle('');
    setActivityDescription('');
    setEditingActivityId(null);
    setActivityDialogOpen(false);
  };

  const removeActivity = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).filter((activity) => activity.id !== activityId),
    });
    setPendingDeleteActivity(null);
  };

  const toggleActivity = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).map((activity) => (
        activity.id === activityId ? { ...activity, completed: !activity.completed } : activity
      )),
    });
  };

  const saveNotes = async (submitEvent) => {
    submitEvent.preventDefault();
    await updateEventItem(user?.uid, isGuest, { ...event, notes: notesDraft.trim() });
    setNotesDialogOpen(false);
  };

  const saveMemory = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!memoryTitle.trim()) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      memories: [...(event.memories || []), {
        id: crypto.randomUUID(),
        title: memoryTitle.trim(),
        body: memoryBody.trim(),
        createdAt: new Date().toISOString(),
      }],
    });
    setMemoryTitle('');
    setMemoryBody('');
    setMemoryDialogOpen(false);
  };

  const removeMemory = async (memoryId) => {
    await updateEventItem(user?.uid, isGuest, { ...event, memories: (event.memories || []).filter((memory) => memory.id !== memoryId) });
    setPendingDeleteMemory(null);
  };

  const addAttachment = async (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      attachments: [...(event.attachments || []), {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'File',
        size: file.size,
        createdAt: new Date().toISOString(),
      }],
    });
    changeEvent.target.value = '';
  };

  const removeAttachment = async (attachmentId) => {
    await updateEventItem(user?.uid, isGuest, { ...event, attachments: (event.attachments || []).filter((attachment) => attachment.id !== attachmentId) });
    setPendingDeleteAttachment(null);
  };

  const printSummary = () => window.print();

  const removeEvent = async () => {
    try {
      await deleteEventItem(user?.uid, isGuest, eventId);
      navigate('/events');
      setPendingDeleteEvent(false);
    } catch (deleteError) {
      console.error('Event deletion failed:', deleteError);
    }
  };

  const renderSectionContent = () => {
    if (activeSection.label === 'Overview') {
      return (
        <div className="workspace-overview-grid">
          <div className="workspace-detail-block"><span>Event type</span><strong>{event.type || 'Personal'}</strong></div>
          <div className="workspace-detail-block"><span>Created</span><strong>{formatDate(event.createdAt)}</strong></div>
          <div className="workspace-notes-block"><div className="workspace-notes-heading"><span>Notes</span><button type="button" onClick={() => { setNotesDraft(event.notes || ''); setNotesDialogOpen(true); }} style={styles.textAction}>Edit notes</button></div><p>{event.notes || 'Add notes to capture the intention and context for this event.'}</p></div>
        </div>
      );
    }

    if (activeSection.label === 'Activities' || activeSection.label === 'Timeline') {
      if (activeSection.label === 'Timeline') {
        return activities.length ? (
          <div className="timeline-list">
            {activities.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <span>{formatDate(activity.date)}</span>
                <strong>{activity.title || 'Untitled activity'}</strong>
                <small>{activity.completed ? 'Completed' : 'In progress'}</small>
                {activity.description ? <p>{activity.description}</p> : null}
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: '#536a5d' }}>Add an activity to start this event timeline.</p>;
      }

      return activities.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {activeSection.label === 'Activities' ? <div style={{ color: '#536a5d', fontSize: '0.88rem' }}>{activities.filter((activity) => activity.completed).length} of {activities.length} complete</div> : null}
          {activities.map((activity) => (
            <div key={activity.id} style={{ padding: '12px', border: '1px solid #edf3ee', borderRadius: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <input type="checkbox" checked={Boolean(activity.completed)} onChange={() => toggleActivity(activity.id)} />
                <span>{activity.title || 'Untitled activity'}</span>
              </label>
              <div style={{ marginTop: '4px', color: '#536a5d', fontSize: '0.88rem' }}>{formatDate(activity.date)}</div>
              {activity.description ? <p style={{ margin: '7px 0 0', color: '#536a5d' }}>{activity.description}</p> : null}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setEditingActivityId(activity.id); setActivityTitle(activity.title || ''); setActivityDescription(activity.description || ''); setActivityDate(activity.date || ''); setActivityDialogOpen(true); }} style={styles.iconButton} aria-label={`Edit ${activity.title}`} title="Edit activity"><Pencil size={15} /></button>
                <button type="button" onClick={() => setPendingDeleteActivity(activity)} style={styles.iconButtonDanger} aria-label={`Remove ${activity.title}`} title="Remove activity"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ margin: 0, color: '#536a5d' }}>No activities have been added to this event yet.</p>;
    }

    if (activeSection.label === 'Attachments') {
      return (
        <div className="workspace-resource-list">
          <label className="workspace-upload-control"><Upload size={16} /> Add attachment<input type="file" onChange={addAttachment} /></label>
          {event.attachments?.length ? event.attachments.map((attachment) => (
            <div className="workspace-resource-row" key={attachment.id}><div><strong>{attachment.name}</strong><span>{attachment.type} · {Math.ceil(attachment.size / 1024)} KB</span></div><button type="button" onClick={() => setPendingDeleteAttachment(attachment)} style={styles.iconButtonDanger} aria-label={`Remove ${attachment.name}`}><Trash2 size={15} /></button></div>
          )) : <div className="workspace-empty-surface"><Images size={24} /><strong>Keep the important pieces together</strong><p>Documents, photos, and keepsakes will stay attached to this event.</p></div>}
        </div>
      );
    }

    if (activeSection.label === 'Memories') {
      return (
        <div className="workspace-resource-list">
          <button type="button" onClick={() => setMemoryDialogOpen(true)} style={styles.primaryButton}>Add memory</button>
          {event.memories?.length ? event.memories.map((memory) => (
            <div className="workspace-resource-row" key={memory.id}><div><strong>{memory.title}</strong><span>{memory.body || 'A memory worth keeping.'}</span></div><button type="button" onClick={() => setPendingDeleteMemory(memory)} style={styles.iconButtonDanger} aria-label={`Remove ${memory.title}`}><Trash2 size={15} /></button></div>
          )) : <div className="workspace-empty-surface"><BookHeart size={24} /><strong>Memory space ready</strong><p>Capture the stories and favorite moments that make {event.name} meaningful.</p></div>}
        </div>
      );
    }

    return <div className="workspace-empty-surface"><Download size={24} /><strong>Export summary</strong><p>A printable summary for {event.name} will be available here.</p><button type="button" onClick={printSummary} style={styles.primaryButton}>Print summary</button></div>;
  };

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ background: '#ffffff', border: '1px solid #dfeae3', borderRadius: '18px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/events" style={{ color: '#1f6f5d', fontWeight: 700 }}>← Back to Events</Link>
          <button type="button" onClick={() => setPendingDeleteEvent(true)} style={styles.deleteEventButton}>Delete event</button>
        </div>
        <div style={{ marginTop: '18px', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6a7d71' }}>
          Event workspace
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: '1.8rem' }}>{event.name}</h2>
        <p style={{ margin: 0, color: '#536a5d', lineHeight: 1.7 }}>
          {formatDate(event.date)}{event.type ? ` · ${event.type}` : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {sections.map((section) => (
          <div
            key={section.label}
            style={{
              border: '1px solid #dfeae3',
              borderRadius: '14px',
              padding: '16px',
              color: '#294736',
              borderColor: activeSection.label === section.label ? '#8fbea4' : '#dfeae3',
              background: activeSection.label === section.label ? '#f0f8f2' : '#ffffff',
            }}
          >
            <Link to={section.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', fontWeight: 700 }}><section.icon size={16} /> {section.label}</Link>
            <div style={{ marginTop: '8px', color: '#536a5d', fontSize: '0.88rem', fontWeight: 400 }}>{section.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #dfeae3', borderRadius: '16px', padding: '20px' }}>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6a7d71' }}>
          {activeSection.label}
        </div>
        <h3 style={{ margin: '8px 0 6px', fontSize: '1.3rem' }}>{activeSection.detail}</h3>
        {error ? <p style={styles.errorText}>{error}</p> : null}
        {activeSection.label === 'Activities' ? <button type="button" onClick={() => { setEditingActivityId(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(new Date().toISOString().slice(0, 10)); setActivityDialogOpen(true); }} style={styles.primaryButton}>Add activity</button> : null}
        {renderSectionContent()}
      </div>

      {activityDialogOpen ? (
        <ModalDialog title={editingActivityId ? 'Edit activity' : 'Add activity'} onClose={() => setActivityDialogOpen(false)}>
          <form onSubmit={addActivity} style={{ display: 'grid', gap: '12px' }}>
            <input value={activityTitle} onChange={(submitEvent) => setActivityTitle(submitEvent.target.value)} placeholder="Activity title" style={styles.input} autoFocus />
            <input type="date" value={activityDate} onChange={(submitEvent) => setActivityDate(submitEvent.target.value)} style={styles.input} />
            <textarea value={activityDescription} onChange={(submitEvent) => setActivityDescription(submitEvent.target.value)} placeholder="Description (optional)" style={styles.input} rows={4} />
            <div style={styles.dialogActions}>
              <button type="button" onClick={() => setActivityDialogOpen(false)} style={styles.cancelButton}>Cancel</button>
              <button type="submit" style={styles.primaryButton}>{editingActivityId ? 'Save activity' : 'Add activity'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {notesDialogOpen ? (
        <ModalDialog title="Edit event notes" onClose={() => setNotesDialogOpen(false)}>
          <form onSubmit={saveNotes} style={{ display: 'grid', gap: '12px' }}>
            <textarea value={notesDraft} onChange={(submitEvent) => setNotesDraft(submitEvent.target.value)} placeholder="What should you remember about this event?" style={styles.input} rows={7} autoFocus />
            <div style={styles.dialogActions}>
              <button type="button" onClick={() => setNotesDialogOpen(false)} style={styles.cancelButton}>Cancel</button>
              <button type="submit" style={styles.primaryButton}>Save notes</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {memoryDialogOpen ? (
        <ModalDialog title="Add memory" onClose={() => setMemoryDialogOpen(false)}>
          <form onSubmit={saveMemory} style={{ display: 'grid', gap: '12px' }}>
            <input value={memoryTitle} onChange={(eventChange) => setMemoryTitle(eventChange.target.value)} placeholder="Memory title" style={styles.input} autoFocus />
            <textarea value={memoryBody} onChange={(eventChange) => setMemoryBody(eventChange.target.value)} placeholder="What do you want to remember?" style={styles.input} rows={6} />
            <div style={styles.dialogActions}><button type="button" onClick={() => setMemoryDialogOpen(false)} style={styles.cancelButton}>Cancel</button><button type="submit" style={styles.primaryButton}>Save memory</button></div>
          </form>
        </ModalDialog>
      ) : null}
      {pendingDeleteMemory ? <ConfirmDialog title="Remove memory?" message={`Remove “${pendingDeleteMemory.title}” from this event?`} onCancel={() => setPendingDeleteMemory(null)} onConfirm={() => removeMemory(pendingDeleteMemory.id)} /> : null}
      {pendingDeleteAttachment ? <ConfirmDialog title="Remove attachment?" message={`Remove “${pendingDeleteAttachment.name}” from this event?`} onCancel={() => setPendingDeleteAttachment(null)} onConfirm={() => removeAttachment(pendingDeleteAttachment.id)} /> : null}
      {pendingDeleteActivity ? (
        <ConfirmDialog
          title="Remove activity?"
          message={`Remove “${pendingDeleteActivity.title || 'Untitled activity'}” from this event?`}
          onCancel={() => setPendingDeleteActivity(null)}
          onConfirm={() => removeActivity(pendingDeleteActivity.id)}
        />
      ) : null}
      {pendingDeleteEvent ? (
        <ConfirmDialog
          title="Delete event?"
          message={`Delete “${event.name}” and its activities? This cannot be undone.`}
          onCancel={() => setPendingDeleteEvent(false)}
          onConfirm={removeEvent}
        />
      ) : null}
    </div>
  );
}

function ModalDialog({ title, onClose, children }) {
  return (
    <div className="lifehub-modal-backdrop" style={styles.modalBackdrop} onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="lifehub-modal-title" style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 id="lifehub-modal-title" style={{ margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Close dialog">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <ModalDialog title={title} onClose={onCancel}>
      <p style={{ margin: '0 0 18px', color: '#536a5d', lineHeight: 1.6 }}>{message}</p>
      <div style={styles.dialogActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Cancel</button>
        <button type="button" onClick={onConfirm} style={styles.confirmButton}>Delete</button>
      </div>
    </ModalDialog>
  );
}

const styles = {
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #d7e3da',
    borderRadius: '10px',
    background: '#fbfdfb',
    color: '#1d3f2c',
  },
  primaryButton: {
    justifySelf: 'start',
    border: 'none',
    borderRadius: '10px',
    background: '#2d6a4f',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteButton: {
    marginTop: '10px',
    border: '1px solid #efcaca',
    borderRadius: '8px',
    background: '#fff1f1',
    color: '#9d3c3c',
    padding: '7px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  editButton: {
    border: '1px solid #d7e3da',
    borderRadius: '8px',
    background: '#f4faf5',
    color: '#1d3f2c',
    padding: '7px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  iconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    border: '1px solid #dfeae3',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#536964',
    cursor: 'pointer',
  },
  iconButtonDanger: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    border: '1px solid #ebcaca',
    borderRadius: '10px',
    background: '#fff5f5',
    color: '#b76060',
    cursor: 'pointer',
  },
  errorText: {
    margin: '0 0 12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#fff1f1',
    color: '#9d3c3c',
    border: '1px solid #efcaca',
  },
  deleteEventButton: {
    border: '1px solid #efcaca',
    borderRadius: '9px',
    background: '#fff1f1',
    color: '#9d3c3c',
    padding: '8px 11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(20, 39, 32, 0.32)',
  },
  modal: {
    width: 'min(520px, 100%)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    padding: '20px',
    borderRadius: '16px',
    background: '#ffffff',
    boxShadow: '0 20px 60px rgba(21, 57, 45, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: '1px solid #d7e3da',
    borderRadius: '8px',
    background: '#f4faf5',
    color: '#1d3f2c',
    cursor: 'pointer',
    fontSize: '1.2rem',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelButton: {
    border: '1px solid #d7e3da',
    borderRadius: '9px',
    background: '#ffffff',
    color: '#1d3f2c',
    padding: '10px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmButton: {
    border: '1px solid #b84b4b',
    borderRadius: '9px',
    background: '#b84b4b',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  textAction: {
    border: 0,
    padding: 0,
    minHeight: 0,
    background: 'transparent',
    color: '#3d6b5b',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
