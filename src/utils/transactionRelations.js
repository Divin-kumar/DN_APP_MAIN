// Mirror activity-linked expense records without creating a second financial ledger.
// Master income/expense collections remain the accounting source of truth.
export const sameRecord = (a, b) => Boolean(a && b && (
  (a.id && b.id && a.id === b.id) ||
  (a.firestoreId && b.firestoreId && a.firestoreId === b.firestoreId)
));

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
