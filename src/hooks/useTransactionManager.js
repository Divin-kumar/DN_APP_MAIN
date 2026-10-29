import { useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
import { transactionPayload } from '../utils/transactionFilters';
import { isNestedOnlyAccountExpense, reconcileExpenseActivities, requireLinkedActivity, sameRecord } from '../utils/transactionRelations';

// One mutation pathway for Financials and global quick-create. The two existing
// collections stay intact for backups and account/guest compatibility.
export default function useTransactionManager() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const incomeActions = useIncomeStore();
  const expenseActions = useExpenseStore();
  const { addIncome, updateIncomeItem, deleteIncomeItem } = incomeActions;
  const { addExpense, updateExpenseItem, deleteExpenseItem, patchLoadedExpenses } = expenseActions;
  const uid = user?.uid;

  const assertContext = useCallback((context) => {
    if (!records.isCurrent(context) || context.uid !== (uid || null) || context.isGuest !== Boolean(isGuest)) {
      throw new Error('Your session changed. Check the saved transaction before retrying.');
    }
  }, [uid, isGuest]);
  const ensureFinanceScope = useCallback(async (context, kinds) => {
    for (const kind of new Set(kinds.filter((value) => ['income', 'expense'].includes(value)))) {
      assertContext(context);
      const store = kind === 'income' ? useIncomeStore : useExpenseStore;
      if (!isRecordScopeLoaded(store.getState(), context.scope, context.sample)) {
        await store.getState()[kind === 'income' ? 'loadIncomes' : 'loadExpenses'](uid, isGuest);
      }
      assertContext(context);
      if (!isRecordScopeLoaded(store.getState(), context.scope, context.sample)) {
        throw new Error('Transactions couldn’t be loaded for this session. Please retry.');
      }
    }
  }, [uid, isGuest, assertContext]);
  const updateMirrors = useCallback(async (previous, current, context) => {
    assertContext(context);
    const state = useEventStore.getState();
    if (current?.eventId) requireLinkedActivity(state.events, current);
    const linked = [previous, current].some((item) => item?.transactionKind === 'expense' && item.activityId);
    if (!linked) return;
    if (!isRecordScopeLoaded(state, context.scope, context.sample)) throw new Error('Moments are still loading. Please retry.');
    const changed = reconcileExpenseActivities(state.events, previous, current);
    for (const event of changed) {
      assertContext(context);
      await records.mutateMoment(context, event.id || event.firestoreId, (latest) => {
        if (current?.eventId === (latest.id || latest.firestoreId)) requireLinkedActivity([latest], current);
        return reconcileExpenseActivities([latest], previous, current)[0] || latest;
      });
    }
    assertContext(context);
  }, [assertContext]);

  const saveTransaction = useCallback(async (form, original = null) => {
    const context = records.capture();
    assertContext(context);
    const settings = useAppStore.getState();
    if (settings.adminValuesLoading || settings.adminValuesError
      || settings.adminValuesOwner !== (isGuest ? 'guest' : uid)) {
      throw new Error('Payment methods are still loading. Reload Code Lists before saving.');
    }
    const payload = transactionPayload(form, {
      paymentMethods: settings.adminValues.paymentMethods,
      previousPaymentMethod: original?.paymentMethod,
      original: original || {},
    });
    if (payload.eventId && !isRecordScopeLoaded(useEventStore.getState(), context.scope, context.sample)) {
      throw new Error('Moments are still loading. Please retry.');
    }
    // Avoid orphan links, including forged/stale navigation prefill parameters.
    requireLinkedActivity(useEventStore.getState().events, payload);
    const nextKind = form.transactionKind;
    const oldKind = original?.transactionKind;
    await ensureFinanceScope(context, [nextKind, oldKind]);
    if (payload.eventId) requireLinkedActivity(useEventStore.getState().events, payload);
    const current = original && oldKind === nextKind
      ? { ...original, ...payload, transactionKind: nextKind }
      : { ...payload, transactionKind: nextKind };

    // Nested-only Firestore records exist inside an event but not the expenses
    // collection. Editing them must not call updateDoc on an absent document.
    if (original && nextKind === oldKind && isNestedOnlyAccountExpense(original, isGuest)) {
      if (!useEventStore.getState().events.some((ev) => (ev.id || ev.firestoreId) === original.eventId)) {
        throw new Error('The linked activity is unavailable. Reload Events and try again.');
      }
      await updateMirrors(original, current, context);
      assertContext(context);
      patchLoadedExpenses(useExpenseStore.getState().expenses.map((item) => (
        sameRecord(item, original) ? { ...item, ...current } : item
      )));
      assertContext(context);
      return current;
    }

    if (original && oldKind === nextKind) {
      if (nextKind === 'income') await updateIncomeItem(uid, isGuest, current);
      else await updateExpenseItem(uid, isGuest, current);
      try { await updateMirrors(original, current, context); }
      catch {
        assertContext(context);
        // Restore the previous master record whenever the nested relationship
        // update fails. Neither write is atomic across Firestore collections.
        try {
          if (nextKind === 'income') await updateIncomeItem(uid, isGuest, original);
          else await updateExpenseItem(uid, isGuest, original);
        } catch { /* Keep the failure visible; manual reconciliation may be needed. */ }
        throw new Error('Transaction could not sync its linked activity. Check the record before retrying.');
      }
      assertContext(context);
      return current;
    }

    const saved = nextKind === 'income'
      ? await addIncome(uid, isGuest, current)
      : await addExpense(uid, isGuest, current);
    const created = { ...saved, transactionKind: nextKind };
    try {
      if (original) {
        await updateMirrors(original, created, context);
        assertContext(context);
        if (oldKind === 'income') await deleteIncomeItem(uid, isGuest, original.id || original.firestoreId);
        else if (!isNestedOnlyAccountExpense(original, isGuest)) {
          await deleteExpenseItem(uid, isGuest, original.id || original.firestoreId);
        } else {
          patchLoadedExpenses(useExpenseStore.getState().expenses.filter((item) => !sameRecord(item, original)));
        }
      } else await updateMirrors(null, created, context);
    } catch {
      assertContext(context);
      // A failed type conversion may have already changed an event's nested
      // expense mirror. Reverse that update BEFORE rolling back the replacement,
      // so a failed source deletion cannot strand an expense in the activity.
      try { await updateMirrors(created, original, context); }
      catch { /* Retain visible error if cross-collection compensation also fails. */ }
      try {
        assertContext(context);
        if (nextKind === 'income') await deleteIncomeItem(uid, isGuest, saved.id || saved.firestoreId);
        else await deleteExpenseItem(uid, isGuest, saved.id || saved.firestoreId);
      } catch { /* The user must check for incomplete conversion. */ }
      throw new Error('Transaction conversion was incomplete and recovery was attempted. Check both types and activity links before retrying.');
    }
    assertContext(context);
    return created;
  }, [uid, isGuest, addIncome, updateIncomeItem, deleteIncomeItem, addExpense,
    updateExpenseItem, deleteExpenseItem, patchLoadedExpenses, updateMirrors, assertContext, ensureFinanceScope]);

  const removeTransaction = useCallback(async (original) => {
    if (!original) return;
    const context = records.capture();
    assertContext(context);
    await ensureFinanceScope(context, [original.transactionKind]);
    const id = original.id || original.firestoreId;
    if (original.transactionKind === 'income') {
      await deleteIncomeItem(uid, isGuest, id);
      return;
    }
    // Only activity-linked expenses have nested mirrors that must be reconciled.
    // Moment-only expenses have no activity child; deletion must still work if
    // their historical Moment is no longer present.
    // Persisted account expenses also retain an independently deletable document
    // when an old parent is missing. Guest/nested-only records need that parent.
    if (original.activityId && (isGuest || isNestedOnlyAccountExpense(original, isGuest))) {
      requireLinkedActivity(useEventStore.getState().events, original);
    }
    await updateMirrors(original, null, context);
    if (isNestedOnlyAccountExpense(original, isGuest)) {
      patchLoadedExpenses(useExpenseStore.getState().expenses.filter((item) => !sameRecord(item, original)));
    } else {
      try { await deleteExpenseItem(uid, isGuest, id); }
      catch (err) {
        assertContext(context);
        try { await updateMirrors(null, original, context); } catch { /* Reconciliation may be needed. */ }
        throw err;
      }
    }
  }, [uid, isGuest, deleteIncomeItem, deleteExpenseItem, patchLoadedExpenses, updateMirrors, assertContext, ensureFinanceScope]);

  return { saveTransaction, removeTransaction };
}
