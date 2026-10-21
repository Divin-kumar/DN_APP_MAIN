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
        expenses = [...expenses.filter((entry) => !sameRecord(entry, current)), {
          id: current.id || current.firestoreId,
          name: current.name || '',
          description: current.description || current.notes || '',
          amount: Number(current.amount || 0),
          date: current.date,
          createdAt: current.createdAt || new Date().toISOString(),
          eventId,
          activityId: activity.id,
        }];
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


// A deep-link query parameter is not proof that a financial relationship exists.
// Never commit orphan transaction links or leave nested expense copies behind.
export const requireLinkedActivity = (events, record) => {
  const eventId = record?.eventId;
  const activityId = record?.activityId;
  if (!eventId && !activityId) return;
  if (!eventId || !activityId) {
    throw new Error('Select a valid linked activity, or clear the activity link.');
  }
  const event = events.find((entry) => entry.id === eventId || entry.firestoreId === eventId);
  const activity = event?.activities?.find((entry) => entry.id === activityId);
  if (!activity) throw new Error('This activity is unavailable. Reload Events, or clear the linked activity.');
};
