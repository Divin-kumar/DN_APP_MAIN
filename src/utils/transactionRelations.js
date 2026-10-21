// Mirror activity-linked expense records without creating a second financial ledger.
// Master income/expense collections remain the accounting source of truth.
// Never equate absent Firestore IDs. Both compared identifiers must exist.
export const sameRecord = (a, b) => Boolean(a && b && (
  (a.id != null && b.id != null && String(a.id).length && String(a.id) === String(b.id)) ||
  (a.firestoreId != null && b.firestoreId != null && String(a.firestoreId).length && String(a.firestoreId) === String(b.firestoreId))
));

export const upsertRecord = (items, record) => {
  const index = items.findIndex((item) => sameRecord(item, record));
  return index < 0 ? [...items, record]
    : items.map((item, i) => i === index ? record : item);
};


// The shared nested expense shape preserves the canonical transaction metadata.
// Historical child expenses without these optional keys remain readable.
export const normalizeActivityExpense = (entry = {}, eventId = null, activityId = null) => ({
  id: entry.id || entry.firestoreId || crypto.randomUUID(),
  name: String(entry.name ?? '').trim(),
  category: entry.category || 'Other',
  description: String(entry.description ?? entry.notes ?? '').trim(),
  notes: String(entry.notes ?? entry.description ?? '').trim(),
  amount: Number(entry.amount || 0),
  date: entry.date || new Date().toISOString().slice(0, 10),
  createdAt: entry.createdAt || new Date().toISOString(),
  eventId: entry.eventId || eventId || null,
  activityId: entry.activityId || activityId || null,
  source: entry.source || 'event-activity',
});

export const reconcileExpenseActivities = (events, previous = null, current = null) => {
  const touched = [];
  for (const event of events) {
    const eventId = event.id || event.firestoreId;
    const removes = previous?.transactionKind === 'expense' && previous.eventId === eventId;
    const adds = current?.transactionKind === 'expense' && current.eventId === eventId;
    if (!removes && !adds) continue;
    let changed = false;
    const activities = (event.activities || []).map((activity) => {
      const removeHere = removes && previous.activityId === activity.id;
      const addHere = adds && current.activityId === activity.id;
      if (!removeHere && !addHere) return activity;
      let expenses = activity.expenses || [];
      if (removeHere) {
        expenses = expenses.filter((entry) => !sameRecord(entry, previous));
        changed = true;
      }
      if (addHere) {
        expenses = [...expenses.filter((entry) => !sameRecord(entry, current)),
          normalizeActivityExpense(current, eventId, activity.id)];
        changed = true;
      }
      return { ...activity, expenses };
    });
    if (changed) touched.push({ ...event, activities });
  }
  return touched;
};

export const isNestedOnlyAccountExpense = (record, isGuest) => Boolean(
  record?.transactionKind === 'expense' && !isGuest &&
  !record.firestoreId && record.eventId && record.activityId
);


// This selector hierarchy is scoped to a single Moment; never list all activities.
// Keep archived Moments available so users can edit existing historical links.
export const getTransactionMoments = (events = []) => (
  events.filter((event) => event.id || event.firestoreId)
    .map((event) => ({
      value: String(event.id || event.firestoreId),
      label: String(event.name || 'Untitled moment'),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
);

export const getMomentActivities = (events = [], eventId = '') => {
  if (!eventId) return [];
  const event = events.find((entry) => String(entry.id || entry.firestoreId) === String(eventId));
  return (event?.activities || [])
    .filter((activity) => activity.id)
    .map((activity) => ({ value: String(activity.id), label: String(activity.title || 'Untitled activity') }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

// A deep-link query parameter is not proof that a financial relationship exists.
// Never commit orphan transaction links or leave nested expense copies behind.
export const requireLinkedActivity = (events, record) => {
  const eventId = record?.eventId;
  const activityId = record?.activityId;
  if (!eventId && !activityId) return;
  if (!eventId) {
    throw new Error('Choose a moment before linking an activity.');
  }
  const event = events.find((entry) => String(entry.id || entry.firestoreId) === String(eventId));
  if (!event) throw new Error('This moment is unavailable. Reload Moments, or clear the moment link.');
  // A transaction can belong to a Moment without belonging to an activity.
  if (!activityId) return;
  const activity = event.activities?.find((entry) => String(entry.id) === String(activityId));
  if (!activity) throw new Error('This activity is unavailable in the chosen moment. Choose another activity or clear the link.');
};
