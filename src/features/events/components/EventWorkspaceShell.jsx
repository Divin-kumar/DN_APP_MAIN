// This is the single-event workspace.
// It is the full detail page for one life moment, where the user can edit the event and manage activities, notes, memories, and spending.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookHeart, CalendarDays, Camera, Check, CircleCheck, Clock3, Download, FileText, FolderOpen, Heart, Images, Link2, ListChecks, Plus, Save, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import ActivityList from '../../../components/events/ActivityList';
import DateField from '../../../components/common/DateField';
import DropdownSelect from '../../../components/common/DropdownSelect';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import useExpenseStore from '../../../store/useExpenseStore';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import ExpenseForm from '../../../components/expenses/ExpenseForm';
import { downloadBlob } from '../../../utils/download';
import { getEventGreeting } from '../../../utils/greeting';
import { ACTIVITY_PRIORITY_OPTIONS, getCodeListLabel, getMomentTypeLabel } from '../../../utils/codeLists';
import usePersistentSort from '../../../hooks/usePersistentSort';
import SortControl from '../../../components/common/SortControl';
import AttachmentStatusBadge from '../../../components/attachments/AttachmentStatusBadge';
import PhotoViewerDialog from '../../../components/attachments/PhotoViewerDialog';
import { getAttachmentLinkLabel, getAttachmentStatus, getAttachmentTypeBucket, sortAttachmentsForGallery } from '../../../utils/attachmentStatus.js';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date to be decided'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};  

const formatBytes = (value = 0) => {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) { amount /= 1024; unit = units[index]; }
  return `${amount.toFixed(1)} ${unit}`;
};

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

function SelectedPhoto({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setFailed(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return <article className="attachment-photo-selection-card">
    <div className="attachment-photo-selection-thumb">{previewUrl && !failed ? <img src={previewUrl} alt="" onError={() => setFailed(true)} /> : <Images size={22} aria-hidden="true" />}</div>
    <div className="attachment-photo-selection-caption"><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)}</small></div>
    <button type="button" aria-label={`Remove ${file.name} from selection`} onClick={onRemove}><X size={15} /></button>
  </article>;
}

function PhotoThumbnail({ attachment, getAttachmentBlob, userId, onOpen }) {
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(Boolean(attachment.hasLocalCopy));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const reference = attachment.previewReference || attachment.fileReference || attachment.url || '';
  const status = getAttachmentStatus(attachment);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSource('');
    setImageLoaded(false);
    setFailed(false);
    if (attachment.hasLocalCopy) {
      setLoading(true);
      void getAttachmentBlob(userId, attachment.id).then((blob) => {
        if (!active) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        } else { setFailed(true); setLoading(false); }
      }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
    } else {
      if (/^https?:\/\//i.test(reference) && status.value !== 'unavailable') { setLoading(true); setSource(reference); }
      else { setLoading(false); setFailed(true); }
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.hasLocalCopy, reference, getAttachmentBlob, userId, status.value]);

  return <button type="button" className="moment-photo-tile" onClick={onOpen} aria-label={`Open photo ${attachment.name || 'untitled'}; status ${status.label}`}>
    <span className={`moment-photo-tile-image${failed ? ' is-unavailable' : ''}`}>
      {loading || (source && !imageLoaded && !failed) ? <span className="moment-photo-loading" role="status">Loading photo…</span> : null}
      {source && !failed && status.value !== 'unavailable' ? <img src={source} alt="" loading="lazy" onLoad={() => { setImageLoaded(true); setLoading(false); }} onError={() => { setFailed(true); setLoading(false); }} /> : !loading ? <span className="moment-photo-unavailable"><Images size={24} /><small>{status.label}</small></span> : null}
    </span>
    <span className="moment-photo-tile-meta"><strong title={attachment.name}>{attachment.name || 'Untitled photo'}</strong><AttachmentStatusBadge attachment={attachment} small /></span>
  </button>;
}

export default function EventWorkspaceShell() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const principal = useAppStore((state) => state.principal);
  const user = principal ? { uid: principal.principalId, displayName: principal.deviceName } : null;
  const isGuest = false;
  const adminValues = useAppStore((state) => state.adminValues);
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const showToast = useAppStore((state) => state.showToast);
  const { events, loading, error, loadEvents, updateEventItem, deleteEventItem, createAttachment, deleteAttachment, getAttachmentBlob } = useEventStore();
  const { expenses, loadExpenses, addExpense, updateExpenseItem } = useExpenseStore();
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityDescription, setActivityDescription] = useState('');
  const [activityPriority, setActivityPriority] = useState('medium');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const { field: activitySort, direction: activitySortDirection, setField: setActivitySort, toggleDirection: toggleActivitySortDirection } = usePersistentSort(`activities-${eventId}`, 'date', 'asc');
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryBody, setMemoryBody] = useState('');
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [pendingDeleteMemory, setPendingDeleteMemory] = useState(null);
  const [pendingDeleteAttachment, setPendingDeleteAttachment] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentReference, setAttachmentReference] = useState('');
  const [attachmentSource, setAttachmentSource] = useState('gallery');
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [keepAttachmentCopy, setKeepAttachmentCopy] = useState(false);
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [attachmentOnMoment, setAttachmentOnMoment] = useState(true);
  const [attachmentActivityId, setAttachmentActivityId] = useState('');
  const [attachmentTypeFilter, setAttachmentTypeFilter] = useState('all');
  const [attachmentStatusFilter, setAttachmentStatusFilter] = useState('all');
  const [attachmentSortMode, setAttachmentSortMode] = useState('recent');
  const [showAllMomentPhotos, setShowAllMomentPhotos] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);
  const [expenseDialogActivity, setExpenseDialogActivity] = useState(null);
  const [linkExpenseActivity, setLinkExpenseActivity] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [greetingDialogOpen, setGreetingDialogOpen] = useState(false);
  const [greetingTitleDraft, setGreetingTitleDraft] = useState('');
  const [greetingBodyDraft, setGreetingBodyDraft] = useState('');

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!events.length) loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [events.length, isGuest, loadEvents, loadExpenses, user]);

  useEffect(() => {
    if (!location.search.includes('create=activity')) return;
    setEditingActivityId(null);
    setActivityTitle('');
    setActivityDescription('');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityPriority('medium');
    setActivityError('');
    setActivityDialogOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => setMemoryExpanded(false), [eventId]);
  useEffect(() => {
    setShowAllMomentPhotos(false);
    setPhotoViewer(null);
  }, [eventId]);

  const event = events.find((item) => (item.id || item.firestoreId) === eventId);

  if (loading && !event) {
    return <p style={{ color: 'var(--ink-soft)' }}>Loading event workspace...</p>;
  }

function AttachmentGalleryItem({ attachment, getAttachmentBlob, userId, eventId, onRemove }) {
  const [localPreview, setLocalPreview] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [localFileMissing, setLocalFileMissing] = useState(false);
  const imageLike = String(attachment.mimeType || attachment.type || '').startsWith('image/');
  const reference = attachment.previewReference || attachment.fileReference || attachment.url || '';
  const resolvedAttachment = localFileMissing ? { ...attachment, hasLocalCopy: false } : attachment;
  const status = getAttachmentStatus(resolvedAttachment);
  const openReference = status.value === 'unavailable' ? '' : localPreview || (/^https?:\/\//i.test(reference) ? reference : '');

  useEffect(() => {
    let objectUrl = '';
    let active = true;
    if (attachment.availability === 'local-copy' || attachment.hasLocalCopy) {
      void getAttachmentBlob(userId, attachment.id).then((blob) => {
        if (!active) return;
        if (!blob) {
          setLocalFileMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setLocalPreview(objectUrl);
      }).catch(() => { if (active) setLocalFileMissing(true); });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.availability, attachment.hasLocalCopy, getAttachmentBlob, imageLike, userId]);

  const preview = status.value !== 'unavailable' && !previewFailed && (localPreview || (imageLike && /^https?:\/\//i.test(reference) ? reference : ''));
  const parentLabelText = getAttachmentLinkLabel((attachment.parentLinks || []).map((link) => link.parentType));

  return (
    <article className="attachment-gallery-card">
      {preview ? <a className="attachment-gallery-preview" href={openReference || preview} target="_blank" rel="noreferrer" aria-label={`Preview ${attachment.name}`}><img src={preview} alt="" loading="lazy" onError={() => setPreviewFailed(true)} /></a> : <span className={`attachment-gallery-placeholder${status.value === 'unavailable' ? ' is-unavailable' : ''}`} aria-label={status.value === 'unavailable' ? 'File unavailable' : `${imageLike ? 'Image' : 'Document'} preview unavailable`}>{imageLike ? <Images size={23} /> : <FileText size={23} />}{status.value === 'unavailable' ? <small>Unavailable</small> : null}</span>}
      <div className="attachment-gallery-copy">
        <strong title={attachment.name}><Link to={`/attachments/${attachment.id}`} state={{ from: `/events/${eventId}/attachments` }}>{attachment.name}</Link></strong>
        <small>{String(attachment.mimeType || attachment.type || 'File').split('/').pop().toUpperCase()} · {formatBytes(Number(attachment.size || 0))}</small>
        <span className="attachment-relationship-badge">{parentLabelText === 'Not linked' ? 'Not linked' : `Linked to: ${parentLabelText}`}</span>
      </div>
      <AttachmentStatusBadge attachment={resolvedAttachment} small />
      {openReference ? <a className="attachment-gallery-open" href={openReference} target="_blank" rel="noreferrer">Open</a> : null}
      <button type="button" className="attachment-gallery-remove" onClick={onRemove} aria-label={`Remove ${attachment.name}`}><Trash2 size={15} /></button>
    </article>
  );
}

  if (!event) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0 }}>Event not found</h2>
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>This event may have been removed or is not available in the current session.</p>
        <Link to="/events" style={{ color: 'var(--primary)', fontWeight: 700 }}>Back to Events</Link>
      </div>
    );
  }

  const sections = [
    { label: 'Overview', path: `/events/${eventId}/overview`, detail: 'Event details and current status', icon: FileText },
    { label: 'Activities', path: `/events/${eventId}/activities`, detail: `${event.activities?.length || 0} activities captured`, icon: ListChecks },
    { label: 'Timeline', path: `/events/${eventId}/timeline`, detail: 'Milestones and progress', icon: Clock3 },
    { label: 'Memories', path: `/events/${eventId}/memories`, detail: `${event.memories?.length || 0} memories saved`, icon: BookHeart },
    { label: 'Attachments', path: `/events/${eventId}/attachments`, detail: `${event.attachments?.length || 0} keepsakes attached`, icon: Images },
  ];
  const activeSection = sections.find((section) => location.pathname === section.path) || sections[0];
  const birthdayAge = String(event.type || '').toLowerCase() === 'birthday' ? getBirthdayAge(event.date) : null;
  const activities = [...(event.activities || [])].sort((first, second) => {
    const dateOrder = new Date(first.date || '9999-12-31').getTime() - new Date(second.date || '9999-12-31').getTime();
    let result = dateOrder;
    if (activitySort === 'title') result = String(first.title || '').localeCompare(String(second.title || ''), undefined, { sensitivity: 'base' });
    if (activitySort === 'priority') {
      const priorityRank = { high: 3, medium: 2, low: 1 };
      result = (priorityRank[String(first.priority || 'medium').toLowerCase()] || 0) - (priorityRank[String(second.priority || 'medium').toLowerCase()] || 0);
    }
    if (activitySort === 'status') {
      const statusRank = (activity) => {
        if (activity.cancelled || activity.status === 'cancelled') return 3;
        if (activity.completed) return 2;
        const activityDate = new Date(`${String(activity.date || '').slice(0, 10)}T00:00:00`);
        return activityDate > new Date(new Date().setHours(0, 0, 0, 0)) ? 1 : 0;
      };
      result = statusRank(first) - statusRank(second);
    }
    if (!result && activitySort !== 'date') result = dateOrder;
    return activitySortDirection === 'desc' ? -result : result;
  });
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = String(activity.title || '').toLowerCase().includes(activitySearch.trim().toLowerCase());
    const isCancelled = activity.cancelled || activity.status === 'cancelled';
    if (activityFilter === 'cancelled') return isCancelled && matchesSearch;
    if (isCancelled) return false;
    const matchesFilter = activityFilter === 'all'
      || (activityFilter === 'in-progress' && !activity.completed)
      || (activityFilter === 'completed' && activity.completed)
      || (activity.priority || 'medium') === activityFilter;
    return matchesSearch && matchesFilter;
  });
  const eventExpenses = expenses.filter((expense) => expense.eventId === eventId);
  const expensesByActivity = Object.fromEntries(activities.map((activity) => [
    activity.id,
    eventExpenses.filter((expense) => expense.activityId === activity.id),
  ]));
  const linkableExpenses = expenses.filter((expense) => (
    !expense.activityId && (!expense.eventId || expense.eventId === eventId)
  ));
  const totalSpent = eventExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const activeActivities = activities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const completedActivities = activeActivities.filter((activity) => activity.completed).length;
  const memoryCount = (event.memories || []).length;
  const attachments = event.attachments || [];
  const latestMemory = [...(event.memories || [])].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))[0];
  const latestMemoryBody = String(latestMemory?.body || '');
  const latestMemoryNeedsExpansion = latestMemoryBody.length > 110 || latestMemoryBody.split(/\r\n|\r|\n/).length > 3;
  const eventDateValue = new Date(event.date || event.startDate || event.createdAt);
  const validEventDate = !Number.isNaN(eventDateValue.getTime());
  const daysUntilEvent = validEventDate ? Math.ceil((new Date(eventDateValue.getFullYear(), eventDateValue.getMonth(), eventDateValue.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000) : null;
  const eventStyle = String(event.type || '').toLowerCase();
  const eventMood = eventStyle.includes('birth') || eventStyle.includes('wedding') || eventStyle.includes('engagement') ? 'celebration' : eventStyle.includes('vacation') || eventStyle.includes('travel') ? 'travel' : eventStyle.includes('investment') || eventStyle.includes('insurance') || eventStyle.includes('finance') ? 'finance' : eventStyle.includes('anniversary') || eventStyle.includes('marriage') ? 'romance' : 'life';
  const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const generatedGreeting = getEventGreeting(event, greetingTemplates, momentTypes) || {
    title: `A moment worth celebrating: ${event.name || getMomentTypeLabel(event, adminValues.eventTypes) || 'today'}`,
    body: event.notes || 'Wishing you a beautiful day filled with meaning and memories to treasure.',
  };
  const eventGreeting = event.greetingCard?.title
    ? event.greetingCard
    : generatedGreeting;

  const openGreetingCard = () => {
    setGreetingTitleDraft(eventGreeting.title || '');
    setGreetingBodyDraft(eventGreeting.body || '');
    setGreetingDialogOpen(true);
  };

  const saveGreetingCard = async (submitEvent) => {
    submitEvent.preventDefault();
    const greetingCard = { title: greetingTitleDraft.trim(), body: greetingBodyDraft.trim(), updatedAt: new Date().toISOString() };
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, greetingCard });
      setGreetingDialogOpen(false);
      showToast('Greeting card saved', 'success');
    } catch {
      showToast('Could not save this greeting card', 'danger');
    }
  };

  const downloadGreetingCard = () => {
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,viewport-fit=cover,user-scalable=no"><title>${escapeHtml(greetingTitleDraft)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b1020;color:#edf3ff;font-family:Inter,system-ui,sans-serif}.card{width:min(640px,100%);padding:clamp(28px,7vw,56px);border:1px solid #35445f;border-radius:28px;background:radial-gradient(circle at 100% 0,#253966,#162033 55%);box-shadow:0 28px 80px #0006}.eyebrow{color:#80aaff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.event{margin-top:22px;color:#a7b3c8;font-size:14px}.title{margin:20px 0 12px;font-size:clamp(30px,7vw,48px);line-height:1.1;letter-spacing:-.04em}.body{color:#c1ccdf;font-size:18px;line-height:1.65;white-space:pre-wrap}</style></head><body><article class="card"><span class="eyebrow">A greeting for today</span><div class="event">${escapeHtml(event.name || getMomentTypeLabel(event, adminValues.eventTypes))} · ${escapeHtml(formatDate(event.date))}</div><h1 class="title">${escapeHtml(greetingTitleDraft)}</h1><p class="body">${escapeHtml(greetingBodyDraft)}</p></article></body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${(event.name || 'dn-greeting').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-greeting.html`);
  };

  const addActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityTitle.trim()) return;
    setActivityError('');

    const existingActivity = (event.activities || []).find((item) => item.id === editingActivityId);
    const activity = {
      id: editingActivityId || crypto.randomUUID(),
      eventId,
      title: activityTitle.trim(),
      date: activityDate,
      description: activityDescription.trim(),
      completed: existingActivity?.completed || false,
      completedAt: existingActivity?.completedAt || null,
      priority: activityPriority,
      createdAt: existingActivity?.createdAt || new Date().toISOString(),
    };

    try {
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
    } catch {
      setActivityError('Could not save this activity. Please try again.');
    }
  };

  const editActivity = (activity) => {
    setPendingDeleteActivity(null);
    setActivityError('');
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title || '');
    setActivityDescription(activity.description || '');
    setActivityDate(activity.date || new Date().toISOString().slice(0, 10));
    setActivityPriority(activity.priority || 'medium');
    setActivityDialogOpen(true);
  };

  const saveActivityExpense = async (formData) => {
    if (!expenseDialogActivity) return;
    try {
      await addExpense(user?.uid, isGuest, {
        ...formData,
        eventId,
        activityId: expenseDialogActivity.id,
        source: 'event-activity',
      });
      setExpenseDialogActivity(null);
      setExpenseError('');
    } catch {
      setExpenseError('Could not save this expense. Please try again.');
    }
  };

  const linkExistingExpense = async (expense) => {
    try {
      await updateExpenseItem(user?.uid, isGuest, { ...expense, eventId, activityId: linkExpenseActivity.id });
      setLinkExpenseActivity(null);
      setExpenseError('');
    } catch {
      setExpenseError('Could not link this expense. Please try again.');
    }
  };

  const removeActivity = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).filter((activity) => activity.id !== activityId),
    });
    setPendingDeleteActivity(null);
  };

  const toggleActivity = async (activityId) => {
    const currentActivity = (event.activities || []).find((activity) => activity.id === activityId);
    if (!currentActivity) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, completed: !activity.completed, completedAt: activity.completed ? null : new Date().toISOString() }
          : activity
      )),
    });
  };

  const toggleActivityCancellation = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, cancelled: !(activity.cancelled || activity.status === 'cancelled'), status: activity.cancelled || activity.status === 'cancelled' ? 'in-progress' : 'cancelled' }
          : activity
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

  const selectAttachmentSource = (source) => {
    setAttachmentSource(source);
    setAttachmentFiles([]);
    setKeepAttachmentCopy(false);
    setAttachmentReference('');
    setAttachmentName('');
  };

  const addAttachment = async (submitEvent) => {
    submitEvent.preventDefault();
    const url = attachmentReference.trim();
    const isExternalLink = attachmentSource === 'external';
    if (isExternalLink && !/^https?:\/\//i.test(url)) {
      showToast('Use a secure web link (https://) or an http:// link.', 'danger');
      return;
    }
    if (isExternalLink && !url) {
      showToast('Enter a URL to add an external link.', 'danger');
      return;
    }
    if (!isExternalLink && !attachmentFiles.length) {
      showToast('Choose at least one item from the selected source.', 'danger');
      return;
    }
    if (!attachmentOnMoment && !attachmentActivityId) {
      showToast('Choose a Moment, an Activity, or both.', 'danger');
      return;
    }
    if (keepAttachmentCopy && !isExternalLink) {
      const localCopyTypes = new Set(['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
      const unsupportedFile = attachmentFiles.find((file) => !file.type.startsWith('image/') && !localCopyTypes.has(file.type));
      if (unsupportedFile) {
        showToast(`${unsupportedFile.name} cannot be kept as a local copy. Add it as a reference or leave Keep Local Copy off.`, 'danger');
        return;
      }
      if (attachmentFiles.some((file) => file.size > 20 * 1024 * 1024)) {
        showToast('Local attachment copies are limited to 20 MB each.', 'danger');
        return;
      }
    }
    const parentLinks = [
      ...(attachmentOnMoment ? [{ parentType: 'moment', parentId: eventId }] : []),
      ...(attachmentActivityId ? [{ parentType: 'activity', parentId: attachmentActivityId }] : []),
    ];
    const filesToAdd = isExternalLink ? [null] : attachmentFiles;
    let addedCount = 0;
    setAttachmentSaving(true);
    try {
      for (const file of filesToAdd) {
        const fileReference = isExternalLink ? url : '';
        await createAttachment(user?.uid, {
          id: crypto.randomUUID(),
          name: isExternalLink ? attachmentName.trim() || url.split('/').pop() || 'External link' : file.name || 'Attachment',
          type: isExternalLink ? 'text/uri-list' : file.type || 'application/octet-stream',
          mimeType: isExternalLink ? 'text/uri-list' : file.type || 'application/octet-stream',
          size: file?.size || 0,
          fileReference,
          availability: isExternalLink ? 'reference' : keepAttachmentCopy ? 'local-copy' : 'unavailable',
          createdAt: new Date().toISOString(),
          source: 'manual',
        }, parentLinks, keepAttachmentCopy ? file : null);
        addedCount += 1;
      }
      setAttachmentName('');
      setAttachmentReference('');
      setAttachmentFiles([]);
      setKeepAttachmentCopy(false);
      setAttachmentOnMoment(true);
      setAttachmentActivityId('');
      if (isExternalLink) showToast('External link added', 'success');
      else if (keepAttachmentCopy) showToast(`${addedCount} ${addedCount === 1 ? 'file' : 'files'} added with local copies`, 'success');
      else showToast(`${addedCount} ${addedCount === 1 ? 'file detail' : 'file details'} saved. The browser cannot preserve the selected file reference; reselect it later or choose Keep Local Copy.`, 'success');
    } catch (error) {
      if (!isExternalLink && addedCount) setAttachmentFiles((current) => current.slice(addedCount));
      const failureMessage = error?.message || 'Attachment could not be added.';
      const addedLabel = attachmentSource === 'gallery' ? `${addedCount} photo${addedCount === 1 ? '' : 's'}` : `${addedCount} file${addedCount === 1 ? '' : 's'}`;
      showToast(addedCount ? `${addedLabel} saved. The remaining selections are ready to retry. ${failureMessage}` : failureMessage, 'danger');
    } finally {
      setAttachmentSaving(false);
    }
  };

  const removeAttachment = async (attachmentId) => {
    await deleteAttachment(user?.uid, attachmentId);
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
        <div className="event-moment-overview">
          <section className="event-featured-memory">
            <div className="event-featured-memory-art"><BookHeart size={21} /><span>Memory keepsake</span></div>
            <div className="event-featured-memory-copy">
              <span className="event-overview-eyebrow"><Heart size={13} /> A piece of this moment</span>
              {latestMemory ? <><h4>{latestMemory.title || 'A memory to keep'}</h4><p className={`event-memory-story-copy free-text-preview${memoryExpanded ? ' is-expanded' : ' is-truncated'}`}>{latestMemory.body || 'A moment worth remembering, kept safe with this event.'}</p><small>{formatDate(latestMemory.createdAt)}</small>{latestMemoryNeedsExpansion ? <button type="button" className="event-memory-expand" onClick={() => setMemoryExpanded((expanded) => !expanded)}>{memoryExpanded ? 'Show less' : 'Read story'}</button> : null}</> : <><h4>Leave room for a memory</h4><p>Save the little details, stories, and feelings you will want to return to.</p><button type="button" className="primaryButton event-empty-state-cta" onClick={() => setMemoryDialogOpen(true)}><Plus size={15} /> Add your first memory</button></>}
            </div>
          </section>

          <section className="event-health-strip" aria-label="Event health">
            <div className="event-overview-section-title"><span>Event health</span><small>A gentle check-in</small></div>
            <div className="event-health-items">
              <span className={activities.length ? 'is-ready' : 'is-pending'}>{activities.length ? <CircleCheck size={15} /> : <CircleCheck size={15} />}{activities.length ? `${activities.length} steps planned` : 'Plan a few steps'}</span>
              <span className={memoryCount ? 'is-ready' : 'is-pending'}>{memoryCount ? <CircleCheck size={15} /> : <Heart size={15} />}{memoryCount ? `${memoryCount} memories saved` : 'Add a memory'}</span>
              <span className={attachments.length ? 'is-ready' : 'is-pending'}>{attachments.length ? <CircleCheck size={15} /> : <Images size={15} />}{attachments.length ? `${attachments.length} keepsakes saved` : 'No keepsakes yet'}</span>
            </div>
          </section>

          <div className="event-overview-lower-grid">
            <section className="event-upcoming-preview">
              <div className="event-overview-section-title"><span>Little next steps</span><button type="button" onClick={() => navigate(`/events/${eventId}/activities`)}>See all</button></div>
              {activities.length ? activities.slice(0, 3).map((activity) => <div className={`event-next-step${activity.completed ? ' is-complete' : ''}`} key={activity.id}><span>{activity.completed ? <Check size={14} /> : null}</span><div><strong>{activity.title || 'Untitled activity'}</strong><small>{activity.completed ? 'Complete' : formatDate(activity.date)}</small></div></div>) : <p className="event-overview-hint">A few gentle reminders can make this moment easier to enjoy.</p>}
            </section>
          </div>

          {event.notes ? <section className="event-reflection-note"><div className="event-overview-section-title"><span>Why this moment matters</span><button type="button" onClick={() => { setNotesDraft(event.notes || ''); setNotesDialogOpen(true); }}>Edit</button></div><p className="free-text-content">{event.notes}</p></section> : null}
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
                    <small className={activity.cancelled || activity.status === 'cancelled' ? 'is-cancelled' : activity.completed ? 'is-complete' : 'is-pending'}>{activity.cancelled || activity.status === 'cancelled' ? 'Cancelled' : activity.completed ? 'Completed' : 'In progress'}</small>
                {activity.description ? <p className="free-text-content">{activity.description}</p> : null}
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: 'var(--ink-soft)' }}>Add an activity to start this event timeline.</p>;
      }

      return (
        <div className="workspace-activities">
          <div className="activity-discovery-bar">
            <label className="activity-search-field"><Search size={15} aria-hidden="true" /><input value={activitySearch} onChange={(changeEvent) => setActivitySearch(changeEvent.target.value)} placeholder="Search activities" aria-label="Search activities by title" /></label>
            <div className="activity-filter-rail" role="group" aria-label="Filter activities">
              {[
                ['all', 'All'],
                ['in-progress', 'In Progress'],
                ['completed', 'Completed'],
                ['cancelled', 'Cancelled'],
                ['high', 'High'],
                ['medium', 'Medium'],
                ['low', 'Low'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={activityFilter === value ? 'is-selected' : ''} aria-pressed={activityFilter === value} onClick={() => setActivityFilter(value)}>{label}</button>
              ))}
            </div>
            <SortControl className="activity-sort-select" field={activitySort} direction={activitySortDirection} onFieldChange={setActivitySort} onToggleDirection={toggleActivitySortDirection} options={[{ value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' }, { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]} label="Sort activities" />
          </div>
          <ActivityList
            eventName={event.name || 'This life moment'}
            activities={filteredActivities}
            allActivities={activities}
            showCancelled={activityFilter === 'cancelled'}
            hasActiveFilters={Boolean(activitySearch.trim()) || activityFilter !== 'all'}
            expensesByActivity={expensesByActivity}
            onToggleComplete={toggleActivity}
            onToggleCancelled={toggleActivityCancellation}
            onAddExpense={(activity) => { setExpenseError(''); setExpenseDialogActivity(activity); }}
            onLinkExpense={(activity) => { setExpenseError(''); setLinkExpenseActivity(activity); }}
            onEdit={editActivity}
            onDelete={(activityId) => setPendingDeleteActivity(activities.find((activity) => activity.id === activityId))}
            onAddActivity={() => { setEditingActivityId(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(new Date().toISOString().slice(0, 10)); setActivityPriority('medium'); setActivityError(''); setActivityDialogOpen(true); }}
            getAttachmentBlob={getAttachmentBlob}
            userId={user?.uid}
            eventId={eventId}
            onOpenPhoto={(photos, index, contextName) => setPhotoViewer({ photos, index, contextName })}
          />
        </div>
      );
    }

    if (activeSection.label === 'Attachments') {
      const visibleAttachments = sortAttachmentsForGallery(attachments.filter((attachment) => (
        (attachmentTypeFilter === 'all' || getAttachmentTypeBucket(attachment) === attachmentTypeFilter)
        && (attachmentStatusFilter === 'all' || getAttachmentStatus(attachment).value === attachmentStatusFilter)
      )), attachmentSortMode);
      const momentPhotos = visibleAttachments.filter((attachment) => getAttachmentTypeBucket(attachment) === 'image');
      const otherAttachments = visibleAttachments.filter((attachment) => getAttachmentTypeBucket(attachment) !== 'image');
      const momentPhotoCount = attachments.filter((attachment) => getAttachmentTypeBucket(attachment) === 'image').length;
      const photosToShow = showAllMomentPhotos ? momentPhotos : momentPhotos.slice(0, 8);
      return (
        <div className="workspace-resource-list">
          <details className="attachment-add-disclosure">
          <summary><Plus size={16} /><span>Add photos or attachment</span></summary>
          <form className="attachment-create-form" onSubmit={(submitEvent) => void addAttachment(submitEvent)}>
            <h3>Add an attachment</h3>
            <p>Choose a source, then connect it to this Moment, an Activity, or both.</p>
            <div className="attachment-source-options" role="group" aria-label="Attachment source">
              <button type="button" className={attachmentSource === 'gallery' ? 'is-selected' : ''} aria-pressed={attachmentSource === 'gallery'} onClick={() => selectAttachmentSource('gallery')}><Images size={17} /><span>Photo Gallery</span></button>
              <button type="button" className={attachmentSource === 'files' ? 'is-selected' : ''} aria-pressed={attachmentSource === 'files'} onClick={() => selectAttachmentSource('files')}><FolderOpen size={17} /><span>Files</span></button>
              <button type="button" className={attachmentSource === 'camera' ? 'is-selected' : ''} aria-pressed={attachmentSource === 'camera'} onClick={() => selectAttachmentSource('camera')}><Camera size={17} /><span>Camera</span></button>
              <button type="button" className={`attachment-source-link${attachmentSource === 'external' ? ' is-selected' : ''}`} aria-pressed={attachmentSource === 'external'} onClick={() => selectAttachmentSource('external')}><Link2 size={15} /><span>External Link</span></button>
            </div>
            {attachmentSource === 'external' ? <>
              <label><span>External URL</span><input type="url" value={attachmentReference} onChange={(inputEvent) => setAttachmentReference(inputEvent.target.value)} placeholder="https://…" /></label>
              <label><span>Display name</span><input value={attachmentName} onChange={(inputEvent) => setAttachmentName(inputEvent.target.value)} placeholder="Reservation, map, web page…" /></label>
              <p className="attachment-source-note">External links remain references. DN does not download their content.</p>
            </> : <>
              <label className="attachment-file-picker"><span>{attachmentSource === 'gallery' ? 'Select photos' : attachmentSource === 'camera' ? 'Capture a photo' : 'Choose files'} <small>{attachmentSource === 'camera' ? 'Your browser may open the device camera.' : attachmentSource === 'gallery' ? 'Choose one or more images.' : 'PDFs, images, Office documents, or text files.'}</small></span><input type="file" accept={attachmentSource === 'gallery' || attachmentSource === 'camera' ? 'image/*' : 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'} capture={attachmentSource === 'camera' ? 'environment' : undefined} multiple={attachmentSource !== 'camera'} onChange={(inputEvent) => { setAttachmentFiles(Array.from(inputEvent.target.files || [])); inputEvent.currentTarget.value = ''; }} /></label>
              {attachmentFiles.length ? <section className={attachmentSource === 'gallery' ? 'attachment-selection-review is-photos' : 'attachment-selection-review'} aria-label={`Review ${attachmentFiles.length} selected ${attachmentSource === 'gallery' ? 'photos' : 'files'}`}>
                <div className="attachment-selection-heading"><strong>Review {attachmentFiles.length} {attachmentSource === 'gallery' ? attachmentFiles.length === 1 ? 'photo' : 'photos' : attachmentFiles.length === 1 ? 'file' : 'files'}</strong><span>Remove anything you don’t want to add.</span></div>
                <div className={attachmentSource === 'gallery' ? 'attachment-photo-selection-grid' : 'attachment-selected-files'}>{attachmentFiles.map((file, index) => attachmentSource === 'gallery'
                  ? <SelectedPhoto key={`${file.name}:${file.lastModified}:${index}`} file={file} onRemove={() => setAttachmentFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} />
                  : <div className="attachment-selected-file" key={`${file.name}:${file.lastModified}:${index}`}><span><strong>{file.name}</strong><small>{String(file.type || 'Unknown type')} · {formatBytes(file.size)}</small></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachmentFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}><X size={14} /></button></div>)}</div>
              </section> : null}
              {attachmentFiles.length ? <>
                <label className="attachment-copy-choice"><input type="checkbox" checked={keepAttachmentCopy} onChange={(inputEvent) => setKeepAttachmentCopy(inputEvent.target.checked)} /><span>Keep local copy in DN ({attachmentFiles.length} {attachmentFiles.length === 1 ? 'file' : 'files'}, {formatBytes(attachmentFiles.reduce((total, file) => total + file.size, 0))}). This uses device storage and enables Include Attachments backups.</span></label>
                {!keepAttachmentCopy ? <p className="attachment-source-warning" role="status">No photo bytes are saved by default. A picker selection is temporary, not a durable reference: without a usable reference DN will show Unavailable and you may need to select the photo again. Reference Only applies only when a usable reference is actually saved. Choose Keep Local Copy to preserve this photo on the device.</p> : null}
              </> : <p className="attachment-source-note">Keep Local Copy is optional and remains off by default.</p>}
            </>}
            <div className="attachment-parent-choices">
              <label><input type="checkbox" checked={attachmentOnMoment} onChange={(inputEvent) => setAttachmentOnMoment(inputEvent.target.checked)} /><span>This Moment</span></label>
              <label><span>Activity</span><select value={attachmentActivityId} onChange={(inputEvent) => setAttachmentActivityId(inputEvent.target.value)}><option value="">Not linked to an Activity</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title || 'Untitled activity'}</option>)}</select></label>
            </div>
            <div className="attachment-parent-preview" role="status"><span>Linked to:</span><strong>{getAttachmentLinkLabel([...(attachmentOnMoment ? ['moment'] : []), ...(attachmentActivityId ? ['activity'] : [])])}</strong></div>
            <button type="submit" className="primaryButton" style={styles.primaryButton} disabled={attachmentSaving}><Plus size={15} /> {attachmentSaving ? 'Adding…' : attachmentSource === 'gallery' && attachmentFiles.length > 1 ? `Add ${attachmentFiles.length} photos` : attachmentSource === 'gallery' ? 'Add photo' : 'Add attachment'}</button>
          </form>
          </details>
          {attachments.length ? <div className="attachment-gallery-toolbar" aria-label="Filter and sort Moment attachments">
            <label><span>Type</span><select value={attachmentTypeFilter} onChange={(inputEvent) => setAttachmentTypeFilter(inputEvent.target.value)}><option value="all">All types</option><option value="image">Images</option><option value="pdf">PDFs</option><option value="document">Documents</option></select></label>
            <label><span>Status</span><select value={attachmentStatusFilter} onChange={(inputEvent) => setAttachmentStatusFilter(inputEvent.target.value)}><option value="all">All statuses</option><option value="available">Available</option><option value="on-device">On This Device</option><option value="reference-only">Reference Only</option><option value="unavailable">Unavailable</option></select></label>
            <label><span>Sort</span><select value={attachmentSortMode} onChange={(inputEvent) => setAttachmentSortMode(inputEvent.target.value)}><option value="recent">Most recent</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="type">Type</option><option value="status">Status</option></select></label>
          </div> : null}
          {attachments.length ? <>
            {momentPhotos.length ? <section className="moment-photo-gallery" aria-label="Moment photos">
              <header className="moment-photo-gallery-heading"><div><h3>Photos</h3><span>{momentPhotoCount} {momentPhotoCount === 1 ? 'photo' : 'photos'} in this Moment{momentPhotos.length !== momentPhotoCount ? ` · ${momentPhotos.length} shown by filters` : ''}</span></div>{momentPhotos.length > 8 ? <button type="button" onClick={() => setShowAllMomentPhotos((current) => !current)}>{showAllMomentPhotos ? 'Show less' : `View all ${momentPhotos.length} photos`}</button> : null}</header>
              <div className="moment-photo-grid">{photosToShow.map((photo, index) => <PhotoThumbnail key={photo.id} attachment={photo} getAttachmentBlob={getAttachmentBlob} userId={user?.uid} onOpen={() => setPhotoViewer({ photos: momentPhotos, index, contextName: event.name || 'This Moment' })} />)}</div>
            </section> : null}
            {otherAttachments.length ? <section className="moment-other-attachments"><h3>{momentPhotos.length ? 'Other attachments' : 'Attachments'}</h3><div className="attachment-gallery-grid">{otherAttachments.map((attachment) => (
              <AttachmentGalleryItem key={attachment.id} attachment={attachment} getAttachmentBlob={getAttachmentBlob} userId={user?.uid} eventId={eventId} onRemove={() => setPendingDeleteAttachment(attachment)} />
            ))}</div></section> : null}
            {!visibleAttachments.length ? <div className="workspace-empty-surface"><Images size={24} /><strong>No attachments match these filters</strong><p>Change the type or status filter to see other attachments.</p></div> : null}
          </> : <div className="workspace-empty-surface"><Images size={24} /><strong>Keep the important pieces together</strong><p>Add photos to this Moment, then open any photo to view its status and links. Choose Keep Local Copy if you want DN to preserve the image on this device.</p></div>}
          {photoViewer ? <PhotoViewerDialog photos={photoViewer.photos} index={photoViewer.index} setIndex={(index) => setPhotoViewer((current) => ({ ...current, index: typeof index === 'function' ? index(current.index) : index }))} contextName={photoViewer.contextName} getAttachmentBlob={getAttachmentBlob} userId={user?.uid} eventId={eventId} onClose={() => setPhotoViewer(null)} /> : null}
        </div>
      );
    }

    if (activeSection.label === 'Memories') {
      return (
        <div className="workspace-resource-list">
          <button type="button" className="primaryButton" onClick={() => setMemoryDialogOpen(true)} style={styles.primaryButton}><Plus size={16} aria-hidden="true" /> Add memory</button>
          {event.memories?.length ? event.memories.map((memory) => (
            <div className="workspace-resource-row workspace-memory-card" key={memory.id}><span className="workspace-memory-kind"><BookHeart size={15} />{/decision/i.test(memory.title || '') ? 'Key decision' : /milestone|first|achievement/i.test(memory.title || '') ? 'Milestone' : 'Memory note'}</span><div><strong>{memory.title}</strong><span className="workspace-memory-body free-text-preview is-truncated">{memory.body || 'A memory worth keeping.'}</span><small>{formatDate(memory.createdAt)}</small></div><button type="button" onClick={() => setPendingDeleteMemory(memory)} style={styles.iconButtonDanger} aria-label={`Remove ${memory.title}`}><Trash2 size={15} /></button></div>
          )) : <div className="workspace-empty-surface"><BookHeart size={24} /><strong>Memory space ready</strong><p>Capture the stories and favorite moments that make {event.name} meaningful.</p></div>}
        </div>
      );
    }

    return <div className="workspace-empty-surface"><Download size={24} /><strong>Export summary</strong><p>A printable summary for {event.name} will be available here.</p><button type="button" className="primaryButton" onClick={printSummary} style={styles.primaryButton}>Print summary</button></div>;
  };

  return (
    <div className="event-workspace-shell">
      <div className="event-workspace-back-row">
        <Link to="/events" className="event-moment-back"><ArrowLeft size={15} /> All moments</Link>
      </div>
      <header className={`event-moment-hero mood-${eventMood}`}>
        <div className="event-moment-cover" aria-hidden="true"><span>{eventMood === 'celebration' ? '✳' : eventMood === 'travel' ? '◒' : eventMood === 'romance' ? '♡' : eventMood === 'finance' ? '⌁' : '✦'}</span></div>
        <div className="event-moment-topline">
          <div className="event-moment-top-actions">
            <button type="button" className="event-moment-memory-action" onClick={() => setMemoryDialogOpen(true)} aria-label="Add memory"><BookHeart size={15} /><span>Add memory</span></button>
            <button type="button" className="event-moment-copy-action" onClick={openGreetingCard} aria-label="Preview and edit greeting card"><Sparkles size={15} /><span>Greeting card</span></button>
            <button type="button" className="event-moment-delete" onClick={() => setPendingDeleteEvent(true)} aria-label="Delete event" title="Delete event"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="event-moment-content">
          <span className="event-moment-kicker"><Sparkles size={13} /> {getMomentTypeLabel(event, adminValues.eventTypes)}</span>
          <h1>{event.name}</h1>
          <div className="event-moment-date">
            <span className="event-moment-date-value"><CalendarDays size={15} /> {formatDate(event.date)}</span>
            {birthdayAge !== null ? <span className="event-moment-turning">· Turning {birthdayAge + 1}</span> : null}
            <span className="event-moment-countdown">· {daysUntilEvent === null ? 'Date to be decided' : daysUntilEvent > 0 ? `${daysUntilEvent} ${daysUntilEvent === 1 ? 'day' : 'days'} remaining` : daysUntilEvent === 0 ? 'Today is the day' : `${Math.abs(daysUntilEvent)} days since this moment`}</span>
          </div>
          <div className="event-moment-stat-line" aria-label="Moment highlights"><strong>{activities.length}</strong> Steps <i>·</i> <strong>{memoryCount}</strong> Memories <i>·</i> <strong>{currency(totalSpent)}</strong> Spent</div>
        </div>
      </header>

      <nav className="event-workspace-nav" aria-label={`${event.name} sections`}>
        {sections.map((section) => (
          <Link
            key={section.label}
            to={section.path}
            className={`event-workspace-nav-item${activeSection.label === section.label ? ' is-active' : ''}`}
            aria-current={activeSection.label === section.label ? 'page' : undefined}
          >
            <section.icon size={16} />
            <span>{section.label}</span>
            {section.label === 'Activities' && activities.length ? <small>{activities.length}</small> : null}
            {section.label === 'Memories' && memoryCount ? <small>{memoryCount}</small> : null}
          </Link>
        ))}
      </nav>

      <main className={`event-workspace-section-panel event-section-${activeSection.label.toLowerCase()}`}>
        <div className={`event-section-heading${activeSection.label === 'Activities' && activities.length ? ' has-activity-action' : ''}`}>
          <span>{activeSection.label === 'Overview' ? 'The story' : activeSection.label === 'Activities' ? 'The little things that make it happen' : activeSection.label === 'Memories' ? 'Hold on to this' : activeSection.detail}</span>
          <h2>{activeSection.label === 'Overview' ? 'A moment worth keeping' : activeSection.label === 'Activities' ? 'Plans for this moment' : activeSection.label === 'Memories' ? 'Memories' : activeSection.label}</h2>
          {activeSection.label === 'Activities' && activities.length ? <button type="button" className="workspace-add-activity" onClick={() => { setEditingActivityId(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(new Date().toISOString().slice(0, 10)); setActivityPriority('medium'); setActivityDialogOpen(true); }}><Plus size={15} aria-hidden="true" /> Add activity</button> : null}
        </div>
        {error ? <p style={styles.errorText}>{error}</p> : null}
        {renderSectionContent()}
      </main>

      {greetingDialogOpen ? (
        <ModalDialog title="Greeting card" onClose={() => setGreetingDialogOpen(false)} className="event-greeting-editor-modal">
          <div className="event-greeting-card-preview">
            <span><Sparkles size={14} /> A greeting for {event.name || 'this moment'}</span>
            <strong>{greetingTitleDraft || 'Your greeting title'}</strong>
            <p className="free-text-content">{greetingBodyDraft || 'Your greeting message will appear here.'}</p>
          </div>
          <form className="form-surface event-greeting-editor" onSubmit={saveGreetingCard}>
            <label>Greeting title<input value={greetingTitleDraft} onChange={(changeEvent) => setGreetingTitleDraft(changeEvent.target.value)} maxLength={120} required /></label>
            <label>Message<textarea value={greetingBodyDraft} onChange={(changeEvent) => setGreetingBodyDraft(changeEvent.target.value)} rows={4} maxLength={500} required /></label>
            <div className="event-greeting-editor-actions">
              <button type="button" className="secondaryButton" onClick={downloadGreetingCard}><Download size={15} /> Download card</button>
              <button type="button" className="event-greeting-close-button" onClick={() => setGreetingDialogOpen(false)}><X size={15} /> Close</button>
              <button type="submit" className="primaryButton"><Save size={15} /> Save greeting</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {activityDialogOpen ? (
        <ModalDialog title={editingActivityId ? 'Edit activity' : 'Add activity'} className="event-activity-editor-modal" onClose={() => { setActivityDialogOpen(false); setEditingActivityId(null); setActivityError(''); }}>
          <form onSubmit={addActivity} style={{ display: 'grid', gap: '12px' }}>
            {activityError ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
            <input value={activityTitle} onChange={(submitEvent) => setActivityTitle(submitEvent.target.value)} placeholder="Activity title" style={styles.input} autoFocus />
            <DateField label="Date" name="activity-date" value={activityDate} onChange={(submitEvent) => setActivityDate(submitEvent.target.value)} />
            <DropdownSelect value={activityPriority} onChange={(submitEvent) => setActivityPriority(submitEvent.target.value)} aria-label="Activity priority">
              {ACTIVITY_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <textarea value={activityDescription} onChange={(submitEvent) => setActivityDescription(submitEvent.target.value)} placeholder="Description (optional)" style={styles.input} rows={4} />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" onClick={() => setActivityDialogOpen(false)}>Cancel</button>
              <button type="submit" className="primaryButton" style={styles.primaryButton}>{editingActivityId ? 'Save activity' : 'Add activity'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {expenseDialogActivity ? (
        <ModalDialog title={`Add expense · ${expenseDialogActivity.title || 'Activity'}`} onClose={() => setExpenseDialogActivity(null)}>
          {expenseError ? <p className="quick-create-error" role="alert">{expenseError}</p> : null}
          <ExpenseForm
            initialValues={{ name: expenseDialogActivity.title || '', category: 'Food', date: new Date().toISOString().slice(0, 10), eventId, activityId: expenseDialogActivity.id }}
            events={[event]}
            submitLabel="Save linked expense"
            onSubmit={saveActivityExpense}
            onCancel={() => setExpenseDialogActivity(null)}
          />
        </ModalDialog>
      ) : null}
      {linkExpenseActivity ? (
        <ModalDialog title={`Link expense · ${linkExpenseActivity.title || 'Activity'}`} onClose={() => setLinkExpenseActivity(null)}>
          {expenseError ? <p className="quick-create-error" role="alert">{expenseError}</p> : null}
          {linkableExpenses.length ? <div className="activity-expense-link-list">{linkableExpenses.map((expense) => <button type="button" className="activity-expense-link-option" key={expense.id || expense.firestoreId} onClick={() => linkExistingExpense(expense)}><span><strong>{expense.name || expense.description || 'Expense'}</strong><small>{getCodeListLabel('expenseCategories', expense.category, adminValues.expenseCategories)} · {formatDate(expense.date)}</small></span><b>{currency(expense.amount)}</b></button>)}</div> : <p className="activity-expense-link-empty">No unlinked expenses are available. Create an expense for this activity instead.</p>}
          <div className="activity-expense-link-footer"><button type="button" className="secondaryButton" onClick={() => { const activity = linkExpenseActivity; setLinkExpenseActivity(null); setExpenseDialogActivity(activity); }}><Plus size={15} aria-hidden="true" /> Create expense</button><button type="button" className="secondaryButton" onClick={() => setLinkExpenseActivity(null)}>Close</button></div>
        </ModalDialog>
      ) : null}
      {notesDialogOpen ? (
        <ModalDialog title="Edit event notes" onClose={() => setNotesDialogOpen(false)}>
          <form onSubmit={saveNotes} style={{ display: 'grid', gap: '12px' }}>
            <textarea value={notesDraft} onChange={(submitEvent) => setNotesDraft(submitEvent.target.value)} placeholder="What should you remember about this event?" style={styles.input} rows={7} autoFocus />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" onClick={() => setNotesDialogOpen(false)}>Cancel</button>
              <button type="submit" className="primaryButton" style={styles.primaryButton}>Save notes</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {memoryDialogOpen ? (
        <ModalDialog title="Add memory" onClose={() => setMemoryDialogOpen(false)}>
          <form onSubmit={saveMemory} style={{ display: 'grid', gap: '12px' }}>
            <input value={memoryTitle} onChange={(eventChange) => setMemoryTitle(eventChange.target.value)} placeholder="Memory title" style={styles.input} autoFocus />
            <textarea value={memoryBody} onChange={(eventChange) => setMemoryBody(eventChange.target.value)} placeholder="What do you want to remember?" style={styles.input} rows={6} />
            <div className="dialog-actions" style={styles.dialogActions}><button type="button" className="secondaryButton" onClick={() => setMemoryDialogOpen(false)}>Cancel</button><button type="submit" className="primaryButton" style={styles.primaryButton}>Save memory</button></div>
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

const styles = {
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
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
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    padding: '7px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  iconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface)',
    color: 'var(--ink-soft)',
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
    background: 'var(--surface)',
    color: 'var(--ink)',
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
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: '1.2rem',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelButton: {
    border: '1px solid var(--border)',
    borderRadius: '9px',
    background: 'var(--surface)',
    color: 'var(--ink)',
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
    color: 'var(--primary)',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
