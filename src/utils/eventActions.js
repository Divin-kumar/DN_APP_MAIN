// Event duplicates retain planning structure, never duplicate booked money or file blobs.
export const duplicateEventData = (event, makeId = () => crypto.randomUUID()) => ({
  name: (event.name || 'Untitled event') + ' (copy)',
  date: event.date,
  type: event.type,
  customType: event.customType || '',
  recurrence: event.recurrence || 'none',
  budget: event.budget || 0,
  notes: event.notes || '',
  archived: false,
  activities: (event.activities || []).map((activity) => ({
    id: makeId(), title: activity.title, date: activity.date, ...(Object.hasOwn(activity, 'time') ? { time: activity.time } : {}),
    description: activity.description || '', priority: activity.priority || 'medium',
    completed: false, cancelled: false, expenses: [],
  })),
  memories: [],
  attachments: [],
  greetingCard: null,
});

export const eventShareDetails = (event, isGuest = false, origin = '') => {
  const id = event.id || event.firestoreId;
  const title = event.name || 'DN event';
  const text = [title, event.date || ''].filter(Boolean).join(' · ');
  const url = !isGuest && id && origin ? origin.replace(/\/$/, '') + '/events/' + encodeURIComponent(id) : undefined;
  return { title, text, ...(url ? { url } : {}) };
};
