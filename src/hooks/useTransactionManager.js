import { useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';
import { transactionPayload } from '../utils/transactionFilters';
import { isNestedOnlyAccountExpense, reconcileExpenseActivities, requireLinkedActivity, sameRecord } from '../utils/transactionRelations';

// One mutation pathway for Financials and global quick-create. The two existing
// collections stay intact for backups and account/guest compatibility.
export default function useTransactionManager() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const incomeActions = useIncomeStore();
  const expenseActions = useExpenseStore();
  const eventActions = useEventStore();
  const { addIncome, updateIncomeItem, deleteIncomeItem } = incomeActions;
  const { addExpense, updateExpenseItem, deleteExpenseItem, patchLoadedExpenses } = expenseActions;
  const { updateEventItem } = eventActions;
  const uid = user?.uid;

  const updateMirrors = useCallback(async (previous, current) => {
    const events = useEventStore.getState().events;
    const changed = reconcileExpenseActivities(events, previous, current);
    for (const event of changed) await updateEventItem(uid, isGuest, event);
  }, [uid, isGuest, updateEventItem]);

  const saveTransaction = useCallback(async (form, original = null) => {
    const payload = transactionPayload(form);
    // Avoid orphan links, including forged/stale navigation prefill parameters.
    requireLinkedActivity(useEventStore.getState().events, payload);
    const nextKind = form.transactionKind;
    const oldKind = original?.transactionKind;
    const current = original && oldKind === nextKind
      ? { ...original, ...payload, transactionKind: nextKind }
      : { ...payload, transactionKind: nextKind };

    // Nested-only Firestore records exist inside an event but not the expenses
    // collection. Editing them must not call updateDoc on an absent document.
    if (original && nextKind === oldKind && isNestedOnlyAccountExpense(original, isGuest)) {
      if (!useEventStore.getState().events.some((ev) => (ev.id || ev.firestoreId) === original.eventId)) {
        throw new Error('The linked activity is unavailable. Reload Events and try again.');
      }
      await updateMirrors(original, current);
      patchLoadedExpenses(useExpenseStore.getState().expenses.map((item) => (
        sameRecord(item, original) ? { ...item, ...current } : item
      )));
      return current;
    }

    if (original && oldKind === nextKind) {
      if (nextKind === 'income') await updateIncomeItem(uid, isGuest, current);
      else await updateExpenseItem(uid, isGuest, current);
      try { await updateMirrors(original, current); }
      catch {
        // Restore the previous master record whenever the nested relationship
        // update fails. Neither write is atomic across Firestore collections.
        try {
          if (nextKind === 'income') await updateIncomeItem(uid, isGuest, original);
          else await updateExpenseItem(uid, isGuest, original);
        } catch { /* Keep the failure visible; manual reconciliation may be needed. */ }
        throw new Error('Transaction could not sync its linked activity. Check the record before retrying.');
      }
      return current;
    }

    const saved = nextKind === 'income'
      ? await addIncome(uid, isGuest, current)
      : await addExpense(uid, isGuest, current);
    const created = { ...saved, transactionKind: nextKind };
    try {
      if (original) {
        await updateMirrors(original, created);
        if (oldKind === 'income') await deleteIncomeItem(uid, isGuest, original.id || original.firestoreId);
        else if (!isNestedOnlyAccountExpense(original, isGuest)) {
          await deleteExpenseItem(uid, isGuest, original.id || original.firestoreId);
        } else {
          patchLoadedExpenses(useExpenseStore.getState().expenses.filter((item) => !sameRecord(item, original)));
        }
      } else await updateMirrors(null, created);
    } catch {
      // A failed type conversion may have already changed an event's nested
      // expense mirror. Reverse that update BEFORE rolling back the replacement,
      // so a failed source deletion cannot strand an expense in the activity.
      try { await updateMirrors(created, original); }
      catch { /* Retain visible error if cross-collection compensation also fails. */ }
      try {
        if (nextKind === 'income') await deleteIncomeItem(uid, isGuest, saved.id || saved.firestoreId);
        else await deleteExpenseItem(uid, isGuest, saved.id || saved.firestoreId);
      } catch { /* The user must check for incomplete conversion. */ }
      throw new Error('Transaction conversion was incomplete and recovery was attempted. Check both types and activity links before retrying.');
    }
    return created;
  }, [uid, isGuest, addIncome, updateIncomeItem, deleteIncomeItem, addExpense,
    updateExpenseItem, deleteExpenseItem, patchLoadedExpenses, updateMirrors]);

  const removeTransaction = useCallback(async (original) => {
    if (!original) return;
    const id = original.id || original.firestoreId;
    if (original.transactionKind === 'income') {
      await deleteIncomeItem(uid, isGuest, id);
      return;
    }
    // Never delete a linked master expense while its activity is not loaded:
    // a nested copy could survive and reappear after refresh.
    requireLinkedActivity(useEventStore.getState().events, original);
    await updateMirrors(original, null);
    if (isNestedOnlyAccountExpense(original, isGuest)) {
      patchLoadedExpenses(useExpenseStore.getState().expenses.filter((item) => !sameRecord(item, original)));
    } else {
      try { await deleteExpenseItem(uid, isGuest, id); }
      catch (err) {
        try { await updateMirrors(null, original); } catch { /* Reconciliation may be needed. */ }
        throw err;
      }
    }
  }, [uid, isGuest, deleteIncomeItem, deleteExpenseItem, patchLoadedExpenses, updateMirrors]);

  return { saveTransaction, removeTransaction };
}
