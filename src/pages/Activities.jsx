import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  X,
  Camera,
  Layers,
  ListChecks,
  Eye,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import DateField from '../components/common/DateField';
import StatePanel from '../components/common/StatePanel';
import SortControl from '../components/common/SortControl';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { ACTIVITY_PRIORITY_OPTIONS, getActivityPriorityLabel } from '../utils/codeLists';
import './activities-page.css';

const PRIORITY_BADGE_CLASSES = {
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  low: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return 'No date';
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (dateStr === tomorrow) return 'Tomorrow';
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === yesterday) return 'Yesterday';

    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function ActivitiesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dashboardActivityId = location.state?.activityId;
  const principal = useAppStore((state) => state.principal);
  const user = principal ? { uid: principal.principalId, displayName: principal.deviceName } : null;
  const isGuest = false;
  const showToast = useAppStore((state) => state.showToast);

  const {
    events,
    standaloneActivities = [],
    loading,
    loadedFor,
    error,
    loadEvents,
    toggleActivityCompletion,
    saveActivity,
    deleteActivity,
  } = useEventStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'today' | 'upcoming' | 'high-priority' | 'standalone' | 'completed'
  const [sortOption, setSortOption] = useState('date'); // 'date' | 'priority' | 'title' | 'recently-updated'
  const [sortDirection, setSortDirection] = useState('asc');

  // Modal states
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(''); // '' means Standalone Activity!

  // Form draft
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftTime, setDraftTime] = useState('');
  const [draftPriority, setDraftPriority] = useState('medium');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.uid && !events.length) {
      loadEvents(user.uid, isGuest);
    }
  }, [user?.uid, events.length, isGuest, loadEvents]);

  // Aggregate all activities: those tied to events + standalone activities
  const allActivities = useMemo(() => {
    const list = [];
    for (const event of events) {
      const eventActivities = event.activities || [];
      for (const act of eventActivities) {
        list.push({
          ...act,
          eventId: event.id || event.firestoreId,
          eventName: event.name || 'Untitled Moment',
          eventCategory: event.type || event.category || 'Personal',
        });
      }
    }
    for (const act of standaloneActivities) {
      list.push({
        ...act,
        eventId: null,
        eventName: 'Standalone Activity',
        eventCategory: 'Standalone',
      });
    }
    return list;
  }, [events, standaloneActivities]);

  // Dashboard activity shortcuts can open the matching activity directly.
  useEffect(() => {
    if (!dashboardActivityId || loading) return;
    const target = allActivities.find((activity) => activity.id === dashboardActivityId);
    if (target) {
      setSelectedActivity(target);
      setModalMode('view');
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [dashboardActivityId, loading, allActivities, navigate, location.pathname]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Filtered and Sorted
  const filteredActivities = useMemo(() => {
    return allActivities
      .filter((activity) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = activity.title?.toLowerCase().includes(q);
          const matchesDesc = activity.description?.toLowerCase().includes(q);
          const matchesEvent = activity.eventName?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesDesc && !matchesEvent) return false;
        }

        // Filter tabs
        if (activeFilter === 'today') {
          return activity.date === todayIso && !activity.completed;
        }
        if (activeFilter === 'upcoming') {
          return activity.date >= todayIso && !activity.completed;
        }
        if (activeFilter === 'high-priority') {
          return activity.priority === 'high' && !activity.completed;
        }
        if (activeFilter === 'standalone') {
          return !activity.eventId && !activity.completed;
        }
        if (activeFilter === 'completed') {
          return Boolean(activity.completed);
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortOption === 'date') {
          const dateA = a.date || '9999-99-99';
          const dateB = b.date || '9999-99-99';
          if (dateA !== dateB) comp = dateA.localeCompare(dateB);
          else comp = (a.time || '').localeCompare(b.time || '');
        } else if (sortOption === 'priority') {
          const weights = { high: 3, medium: 2, low: 1 };
          const pA = weights[a.priority] || 2;
          const pB = weights[b.priority] || 2;
          if (pB !== pA) comp = pB - pA;
          else comp = (a.date || '').localeCompare(b.date || '');
        } else if (sortOption === 'title') {
          comp = (a.title || '').localeCompare(b.title || '');
        } else if (sortOption === 'recently-updated') {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          comp = tB - tA;
        }
        return sortDirection === 'desc' ? -comp : comp;
      });
  }, [allActivities, searchQuery, activeFilter, sortOption, sortDirection, todayIso]);

  // Handlers
  const handleToggleComplete = async (activity, e) => {
    e?.stopPropagation();
    try {
      await toggleActivityCompletion(user?.uid, isGuest, activity.id, activity.eventId);
      showToast(
        activity.completed ? 'Activity marked incomplete' : 'Activity completed!',
        'success'
      );
    } catch {
      showToast('Could not update activity status', 'danger');
    }
  };

  const openCreateModal = () => {
    setSelectedActivity(null);
    setSelectedEventId(''); // Standalone by default, or user selects moment
    setDraftTitle('');
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftTime('');
    setDraftPriority('medium');
    setDraftDescription('');
    setDraftAttachments([]);
    setFormError('');
    setModalMode('create');
  };

  const openEditModal = (activity, e) => {
    e?.stopPropagation();
    setSelectedActivity(activity);
    setSelectedEventId(activity.eventId || '');
    setDraftTitle(activity.title || '');
    setDraftDate(activity.date || new Date().toISOString().slice(0, 10));
    setDraftTime(activity.time || '');
    setDraftPriority(activity.priority || 'medium');
    setDraftDescription(activity.description || '');
    setDraftAttachments(activity.attachments || []);
    setFormError('');
    setModalMode('edit');
  };

  const openViewModal = (activity) => {
    setSelectedActivity(activity);
    setModalMode('view');
  };

  const openDeleteModal = (activity, e) => {
    e?.stopPropagation();
    setPendingDeleteActivity(activity);
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a photo image file.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const newAtt = {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'image',
        mimeType: file.type,
        size: file.size,
        previewReference: dataUrl,
        fileReference: dataUrl,
        blob: file,
        createdAt: new Date().toISOString(),
      };
      setDraftAttachments((prev) => [...prev, newAtt]);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveDraftAttachment = (id) => {
    setDraftAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveActivityForm = async (e) => {
    e.preventDefault();
    if (!draftTitle.trim()) {
      setFormError('Please provide an activity title.');
      return;
    }

    try {
      const activityPayload = {
        id: selectedActivity?.id || crypto.randomUUID(),
        title: draftTitle.trim(),
        date: draftDate,
        time: draftTime.trim(),
        priority: draftPriority,
        description: draftDescription.trim(),
        completed: selectedActivity?.completed || false,
        completedAt: selectedActivity?.completedAt || null,
        attachments: draftAttachments,
      };

      // If selectedEventId is empty, it saves as a standalone activity!
      await saveActivity(user?.uid, isGuest, selectedEventId || null, activityPayload);
      setModalMode(null);
      showToast(
        modalMode === 'create' ? 'Activity created successfully' : 'Activity updated',
        'success'
      );
    } catch {
      setFormError('Failed to save activity. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteActivity) return;
    try {
      await deleteActivity(user?.uid, isGuest, pendingDeleteActivity.eventId, pendingDeleteActivity.id);
      setPendingDeleteActivity(null);
      if (modalMode === 'view' && selectedActivity?.id === pendingDeleteActivity.id) {
        setModalMode(null);
      }
      showToast('Activity deleted', 'success');
    } catch {
      showToast('Could not delete activity', 'danger');
    }
  };

  return (
    <div className="financial-module-page activities-page">
      {/* Header matching LifeHub modules */}
      <header className="financial-module-heading activities-heading">
        <h3>Activities</h3>
        <button
          type="button"
          onClick={openCreateModal}
          className="primaryButton activities-create-button"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>New Activity</span>
        </button>
      </header>

      {/* Search and Filters Toolbar matching other pages */}
      <div className="financial-module-toolbar activities-toolbar">
        <div className="activities-search">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities, notes, or moments…"
            aria-label="Search activities"
            className="w-full pl-9"
          />
        </div>

        <DropdownSelect
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          aria-label="Filter activities"
        >
          <option value="all">All activities ({allActivities.length})</option>
          <option value="today">Today's activities</option>
          <option value="upcoming">Upcoming activities</option>
          <option value="high-priority">High priority</option>
          <option value="standalone">Standalone activities</option>
          <option value="completed">Completed activities</option>
        </DropdownSelect>

        <SortControl
          field={sortOption}
          direction={sortDirection}
          onFieldChange={setSortOption}
          onToggleDirection={toggleSortDirection}
          options={[
            { value: 'date', label: 'Due date' },
            { value: 'priority', label: 'Priority' },
            { value: 'title', label: 'Title' },
            { value: 'recently-updated', label: 'Recently updated' },
          ]}
          label="Sort activities"
        />
      </div>

      {/* Filter Rail with Quick Access Tabs */}
      <div className="activities-filter-rail">
        {[
          { id: 'all', label: 'All', count: allActivities.length },
          {
            id: 'today',
            label: 'Today',
            count: allActivities.filter((a) => a.date === todayIso && !a.completed).length,
          },
          {
            id: 'upcoming',
            label: 'Upcoming',
            count: allActivities.filter((a) => a.date >= todayIso && !a.completed).length,
          },
          {
            id: 'high-priority',
            label: 'High Priority',
            count: allActivities.filter((a) => a.priority === 'high' && !a.completed).length,
          },
          {
            id: 'standalone',
            label: 'Standalone',
            count: allActivities.filter((a) => !a.eventId && !a.completed).length,
          },
          {
            id: 'completed',
            label: 'Completed',
            count: allActivities.filter((a) => a.completed).length,
          },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              aria-pressed={isActive}
              className={`activities-filter-chip flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${isActive ? 'is-active' : ''}`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-emerald-700 text-emerald-100'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Activity List: use the same inset history surface as Expenses. */}
      <section className="financial-module-history activities-history" aria-label="Activity history">
      {loading && !allActivities.length ? (
        <LoadingSkeleton rows={4} variant="financial" label="Loading activities" />
      ) : filteredActivities.length === 0 ? (
        <StatePanel
          variant="empty"
          icon={ListChecks}
          title={
            searchQuery
              ? `No activities match "${searchQuery}"`
              : activeFilter === 'today'
              ? 'No activities scheduled for today'
              : activeFilter === 'high-priority'
              ? 'No high-priority activities pending'
              : activeFilter === 'standalone'
              ? 'No standalone activities'
              : activeFilter === 'completed'
              ? 'No completed activities yet'
              : 'No activities found'
          }
          description="Keep your plans organized by creating a standalone or moment-linked activity."
          actionLabel="Create Activity"
          onAction={openCreateModal}
        />
      ) : (
        <div className="activities-list">
          {filteredActivities.map((activity) => {
            const isCompleted = Boolean(activity.completed);
            const isOverdue = !isCompleted && activity.date && activity.date < todayIso;
            const priorityBadge = PRIORITY_BADGE_CLASSES[activity.priority] || PRIORITY_BADGE_CLASSES.medium;
            const isStandalone = !activity.eventId;

            return (
              <div
                key={activity.id}
                onClick={() => openViewModal(activity)}
                className={`history-row activity-list-card group flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isCompleted
                    ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-xs'
                }`}
              >
                {/* Checkbox + Title + Meta */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => handleToggleComplete(activity, e)}
                    aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    className={`activity-completion-toggle mt-0.5 sm:mt-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {activity.title}
                      </span>

                      {/* Priority Tag */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityBadge}`}
                      >
                        {getActivityPriorityLabel(activity.priority)}
                      </span>

                      {/* Moment or Standalone Tag */}
                      {isStandalone ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                          <Layers size={10} />
                          Standalone
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                          in <span className="font-medium text-slate-700 dark:text-slate-300">{activity.eventName}</span>
                        </span>
                      )}

                      {/* Photo indicator */}
                      {activity.attachments && activity.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <ImageIcon size={12} className="text-emerald-600" />
                          <span>{activity.attachments.length}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
                        }`}
                      >
                        <Calendar size={13} className="text-slate-400" />
                        {isOverdue ? 'Overdue · ' : ''}
                        {formatDateLabel(activity.date)}
                      </span>
                      {activity.time && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={12} />
                          {activity.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => openEditModal(activity, e)}
                    className="activity-row-action p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit"
                    aria-label={`Edit ${activity.title || "activity"}`}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openDeleteModal(activity, e)}
                    className="activity-row-action p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete"
                    aria-label={`Delete ${activity.title || "activity"}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      {/* Create / Edit Modal using the shared financial-entry form treatment */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <ModalDialog
          title={modalMode === 'create' ? 'Create Activity' : 'Edit Activity'}
          onClose={() => setModalMode(null)}
        >
          <form onSubmit={handleSaveActivityForm} className="form-surface financial-entry-form activities-form" noValidate>
            {formError && (
              <p className="quick-create-error" role="alert">
                {formError}
              </p>
            )}

            {/* Moment Selection (Optional / Standalone allowed) */}
            <div>
              <label htmlFor="activity-moment-select">
                Life Moment <span className="event-form-optional">Optional</span>
              </label>
              <DropdownSelect
                id="activity-moment-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                <option value="">None (Standalone Activity)</option>
                {events.map((ev) => (
                  <option key={ev.id || ev.firestoreId} value={ev.id || ev.firestoreId}>
                    {ev.name || 'Untitled Moment'}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="activity-title-input">Activity title</label>
              <input
                id="activity-title-input"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g. Confirm dinner reservation"
                required
                autoFocus
              />
            </div>

            {/* Date & Time */}
            <div className="activities-date-time-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-field-wrap">
                <DateField
                  label="Date"
                  id="activity-date-input"
                  name="activity-date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="activity-time-input">
                  Scheduled time <span className="event-form-optional">Optional</span>
                </label>
                <input
                  id="activity-time-input"
                  type="time"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="activity-priority-select">Priority</label>
              <DropdownSelect
                id="activity-priority-select"
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value)}
              >
                {ACTIVITY_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="activity-desc-input">
                Notes &amp; Context <span className="event-form-optional">Optional</span>
              </label>
              <textarea
                id="activity-desc-input"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={3}
                placeholder="Add helpful details, locations, contact info…"
              />
            </div>

            {/* Photos & Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Photos &amp; Attachments
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Camera size={14} /> Add photo
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {draftAttachments.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {draftAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-video"
                    >
                      {att.previewReference ? (
                        <img
                          src={att.previewReference}
                          alt={att.name || 'Preview'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={20} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftAttachment(att.id)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors"
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No photos attached yet.</p>
              )}
            </div>

            {/* Dialog Actions */}
            <div className="dialog-actions pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="secondaryButton"
              >
                Cancel
              </button>
              <button type="submit" className="primaryButton">
                {modalMode === 'create' ? 'Save Activity' : 'Update Activity'}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* View Detail Modal */}
      {modalMode === 'view' && selectedActivity && (
        <ModalDialog title="Activity Details" onClose={() => setModalMode(null)}>
          <div className="activities-detail space-y-4">
            <div className="activities-detail-header flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedActivity.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedActivity.eventId ? (
                    <>
                      Moment:{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedActivity.eventName}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                      <Layers size={12} /> Standalone Activity
                    </span>
                  )}
                </p>
              </div>

              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  PRIORITY_BADGE_CLASSES[selectedActivity.priority] || PRIORITY_BADGE_CLASSES.medium
                }`}
              >
                {getActivityPriorityLabel(selectedActivity.priority)} Priority
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Date &amp; Time</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateLabel(selectedActivity.date)}{' '}
                  {selectedActivity.time ? `· ${selectedActivity.time}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Status</span>
                <span
                  className={`font-semibold ${
                    selectedActivity.completed ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {selectedActivity.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>

            {selectedActivity.description && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Notes
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedActivity.description}
                </p>
              </div>
            )}

            {selectedActivity.attachments && selectedActivity.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Photos ({selectedActivity.attachments.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedActivity.attachments.map((att) => (
                    <div
                      key={att.id}
                      onClick={() => setPreviewImage(att.previewReference || att.fileReference)}
                      className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-video group"
                    >
                      {att.previewReference || att.fileReference ? (
                        <img
                          src={att.previewReference || att.fileReference}
                          alt={att.name || 'Photo'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="dialog-actions pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => handleToggleComplete(selectedActivity, e)}
                className={`primaryButton flex items-center gap-1.5 ${
                  selectedActivity.completed ? 'bg-amber-600 hover:bg-amber-700' : ''
                }`}
              >
                <Check size={14} />
                <span>{selectedActivity.completed ? 'Reopen Activity' : 'Mark Complete'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedActivity)}
                  className="secondaryButton"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => openDeleteModal(selectedActivity, e)}
                  className="secondaryButton text-rose-600 hover:text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Delete Confirmation Dialog using standard ConfirmDialog */}
      {pendingDeleteActivity ? (
        <ConfirmDialog
          title="Delete activity?"
          message={`Delete “${pendingDeleteActivity.title || 'Untitled activity'}”? This cannot be undone.`}
          onCancel={() => setPendingDeleteActivity(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-zoom-out"
        >
          <img
            src={previewImage}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
