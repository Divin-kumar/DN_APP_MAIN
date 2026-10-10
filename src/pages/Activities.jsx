import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Flame,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  Eye,
  X,
  Camera,
  FolderOpen,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import DateField from '../components/common/DateField';
import { ACTIVITY_PRIORITY_OPTIONS } from '../utils/codeLists';

const PRIORITY_COLORS = {
  high: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
    label: 'High',
  },
  medium: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    label: 'Medium',
  },
  low: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    label: 'Low',
  },
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
  const principal = useAppStore((state) => state.principal);
  const user = principal ? { uid: principal.principalId, displayName: principal.deviceName } : null;
  const isGuest = false;
  const showToast = useAppStore((state) => state.showToast);

  const {
    events,
    loading,
    loadEvents,
    toggleActivityCompletion,
    saveActivity,
    deleteActivity,
    createAttachment,
  } = useEventStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'today' | 'upcoming' | 'high-priority' | 'completed' | 'all'
  const [sortOption, setSortOption] = useState('date'); // 'date' | 'priority' | 'recently-updated'

  // Modal states
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | 'delete'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState('');

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

  // Aggregate all activities across all events
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
    return list;
  }, [events]);

  // Filtered and Sorted
  const filteredActivities = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

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
        if (activeFilter === 'completed') {
          return Boolean(activity.completed);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'date') {
          const dateA = a.date || '9999-99-99';
          const dateB = b.date || '9999-99-99';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return (a.time || '').localeCompare(b.time || '');
        }
        if (sortOption === 'priority') {
          const weights = { high: 3, medium: 2, low: 1 };
          const pA = weights[a.priority] || 2;
          const pB = weights[b.priority] || 2;
          if (pB !== pA) return pB - pA;
          return (a.date || '').localeCompare(b.date || '');
        }
        if (sortOption === 'recently-updated') {
          const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tB - tA;
        }
        return 0;
      });
  }, [allActivities, searchQuery, activeFilter, sortOption]);

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
    setSelectedEventId(events[0]?.id || events[0]?.firestoreId || '');
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
    setSelectedEventId(activity.eventId);
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
    setSelectedActivity(activity);
    setModalMode('delete');
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
    if (!selectedEventId) {
      setFormError('Please select a Life Moment for this activity.');
      return;
    }
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

      await saveActivity(user?.uid, isGuest, selectedEventId, activityPayload);
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
    if (!selectedActivity) return;
    try {
      await deleteActivity(user?.uid, isGuest, selectedActivity.eventId, selectedActivity.id);
      setModalMode(null);
      showToast('Activity deleted', 'success');
    } catch {
      showToast('Could not delete activity', 'danger');
    }
  };

  return (
    <div className="activities-page max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Activities
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your daily tasks, plans, and moments across LifeHub.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold shadow-sm shadow-emerald-700/20 transition-all cursor-pointer"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>New Activity</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activities, notes, or moments…"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-slate-400 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="date">Sort by Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="recently-updated">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Activities', count: allActivities.length },
            {
              id: 'today',
              label: 'Today',
              count: allActivities.filter(
                (a) => a.date === new Date().toISOString().slice(0, 10) && !a.completed
              ).length,
            },
            {
              id: 'upcoming',
              label: 'Upcoming',
              count: allActivities.filter(
                (a) => a.date >= new Date().toISOString().slice(0, 10) && !a.completed
              ).length,
            },
            {
              id: 'high-priority',
              label: 'High Priority',
              count: allActivities.filter((a) => a.priority === 'high' && !a.completed).length,
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
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
      </div>

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No activities found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No activities match "${searchQuery}". Try a different search term.`
              : activeFilter === 'today'
              ? 'You have no activities scheduled for today. Create one to stay organized!'
              : activeFilter === 'high-priority'
              ? 'No high-priority activities pending. Great job staying on track!'
              : activeFilter === 'completed'
              ? 'No completed activities yet.'
              : 'Add your first activity to track your plans and life moments.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus size={16} /> Create Activity
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredActivities.map((activity) => {
            const isCompleted = Boolean(activity.completed);
            const priorityInfo = PRIORITY_COLORS[activity.priority] || PRIORITY_COLORS.medium;
            const hasAttachments = activity.attachments && activity.attachments.length > 0;

            return (
              <div
                key={activity.id}
                onClick={() => openViewModal(activity)}
                className={`group flex items-start sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs transition-all cursor-pointer ${
                  isCompleted ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50' : ''
                }`}
              >
                {/* Left: Checkbox + Title + Metadata */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => handleToggleComplete(activity, e)}
                    aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    className={`mt-0.5 sm:mt-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
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
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityInfo.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dot}`} />
                        {priorityInfo.label}
                      </span>

                      {/* Photo indicator */}
                      {hasAttachments && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <ImageIcon size={13} className="text-emerald-600" />
                          <span>{activity.attachments.length}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar size={13} className="text-slate-400" />
                        {formatDateLabel(activity.date)}
                      </span>
                      {activity.time && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={12} />
                          {activity.time}
                        </span>
                      )}
                      <span className="text-slate-400 truncate max-w-[160px]">
                        in <span className="font-medium text-slate-600 dark:text-slate-300">{activity.eventName}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => openEditModal(activity, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openDeleteModal(activity, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <ModalDialog
          title={modalMode === 'create' ? 'Create Activity' : 'Edit Activity'}
          onClose={() => setModalMode(null)}
        >
          {formError && (
            <p className="mb-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg" role="alert">
              {formError}
            </p>
          )}

          <form onSubmit={handleSaveActivityForm} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Moment
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {events.map((ev) => (
                  <option key={ev.id || ev.firestoreId} value={ev.id || ev.firestoreId}>
                    {ev.name || 'Untitled Moment'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Activity Title
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g. Confirm dinner reservation"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Time <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="time"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes & Context <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={3}
                placeholder="Add helpful details, locations, contact info…"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Photo Attachments from Gallery */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Photos & Attachments
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Camera size={14} /> Add photo from gallery
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
                      className="relative group rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-video"
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs"
              >
                {modalMode === 'create' ? 'Save Activity' : 'Update Activity'}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* View Detail Modal */}
      {modalMode === 'view' && selectedActivity && (
        <ModalDialog
          title="Activity Details"
          onClose={() => setModalMode(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedActivity.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  In Moment: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedActivity.eventName}</span>
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  PRIORITY_COLORS[selectedActivity.priority]?.badge || PRIORITY_COLORS.medium.badge
                }`}
              >
                {PRIORITY_COLORS[selectedActivity.priority]?.label || 'Medium'} Priority
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Date & Time</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateLabel(selectedActivity.date)} {selectedActivity.time ? `· ${selectedActivity.time}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Status</span>
                <span className={`font-semibold ${selectedActivity.completed ? 'text-emerald-600' : 'text-amber-600'}`}>
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

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => handleToggleComplete(selectedActivity, e)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selectedActivity.completed
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <Check size={14} />
                {selectedActivity.completed ? 'Reopen Activity' : 'Mark Complete'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedActivity)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(selectedActivity)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Delete Confirmation Modal */}
      {modalMode === 'delete' && selectedActivity && (
        <ModalDialog
          title="Delete Activity"
          onClose={() => setModalMode(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete &ldquo;<strong>{selectedActivity.title}</strong>&rdquo;? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

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
