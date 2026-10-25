/*
  Expense state actions keep master financial records in sync with the UI.

  This store handles all expense-related data, including loading, creating, updating, and deleting records.
*/
import { create } from 'zustand';
import {
  createExpense,
  deleteExpense,
  getExpensesForUser,
  getGuestExpenses,
  removeGuestExpense,
  saveGuestExpense,
  updateExpense,
} from '../services/expenseService';
import { requireActiveSampleData as getActiveSampleData, getActiveSampleScenario, saveActiveSampleData } from '../dev/sampleData';
import { sameRecord } from '../utils/transactionRelations';
import { beginFinancialLoad, isFinancialScopeLoaded } from '../utils/financialLoadScope';

const getLoadKey = (uid, isGuest) => `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;

const useExpenseStore = create((set, get) => {
  const pendingLoads = new Map();

  return ({
  expenses: [],
  pendingCreateIds: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,
  loadedSample: null, activeSample: null, scopeRevision: 0,

  // A complete replacement (restore/account switch) resets ownership metadata.
  setExpenses: (items) => set((state) => ({ expenses: items, pendingCreateIds: [], loading: false, error: null, loadedFor: null, activeLoadKey: null,
    loadedSample: null, activeSample: null, scopeRevision: state.scopeRevision + 1 })),
  // An in-memory edit of a nested-only expense must retain the account/guest
  // scope already verified by loadExpenses, or Financials hides every record.
  patchLoadedExpenses: (items) => set({ expenses: items, loading: false, error: null }),

  loadExpenses: async (uid, isGuest) => {
    const loadKey = getLoadKey(uid, isGuest);
    const sample = getActiveSampleScenario(uid);
    const requestKey = JSON.stringify([loadKey, sample]);
    if (isFinancialScopeLoaded(get(), loadKey) && (get().loadedSample ?? null) === sample && (get().activeSample ?? null) === sample) return get().expenses;
    const changed = get().activeLoadKey !== loadKey || (get().activeSample ?? null) !== sample;
    set({ ...beginFinancialLoad(get(), loadKey, 'expenses'), activeSample: sample,
      ...(changed ? { expenses: [], pendingCreateIds: [], loadedFor: null, loadedSample: null, scopeRevision: get().scopeRevision + 1 } : {}) });
    // Re-select an in-flight account when rapidly switching A → B → A.
    if (pendingLoads.has(requestKey)) return pendingLoads.get(requestKey);

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        if (sampleData) {
          if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ expenses: sampleData.expenses, loading: false, error: null, loadedFor: loadKey, loadedSample: sample });
          return sampleData.expenses;
        }

        const items = isGuest
          ? getGuestExpenses()
          : await getExpensesForUser(uid);

        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ expenses: items, loading: false, error: null, loadedFor: loadKey, loadedSample: sample });
        return items;
      } catch (error) {
        console.error('Failed to load expenses:', error);
        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ loading: false, error: 'Unable to load expenses.' });
        return [];
      } finally {
        pendingLoads.delete(requestKey);
      }
    });
    pendingLoads.set(requestKey, request);

    return request;
  },

  addExpense: async (uid, isGuest, expense) => {
    const normalized = {
      ...expense,
      id: expense.id || crypto.randomUUID(),
      amount: Number(expense.amount || 0),
      date: expense.date || new Date().toISOString().slice(0, 10),
    };

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = [normalized, ...sampleData.expenses];
      saveActiveSampleData({ ...sampleData, expenses: updated });
      set({ expenses: updated, loading: false });
      return normalized;
    }

    if (isGuest) {
      const updated = saveGuestExpense(normalized);
      set({ expenses: updated, loading: false });
      return normalized;
    }

    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const previous = get().expenses;
    const optimistic = [normalized, ...previous];
    set({ expenses: optimistic, pendingCreateIds: [...get().pendingCreateIds, String(normalized.id)], loading: false, error: null });

    try {
      const saved = await createExpense(uid, normalized);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) return saved;
      set({
        pendingCreateIds: get().pendingCreateIds.filter((id) => id !== String(normalized.id)),
        expenses: [saved, ...get().expenses.filter((item) => item.id !== normalized.id && (item.firestoreId || item.id) !== (normalized.firestoreId || normalized.id))],
        error: null,
      });
      return saved;
    } catch (error) {
      console.error('Failed to create expense:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
      set({
        pendingCreateIds: get().pendingCreateIds.filter((id) => id !== String(normalized.id)),
        expenses: get().expenses.filter((item) => item.id !== normalized.id && item.firestoreId !== normalized.id),
        error: 'Unable to create the expense. Your changes were restored.',
      });
      throw error;
    }
  },

  updateExpenseItem: async (uid, isGuest, expense) => {
    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.expenses.map((item) => item.id === expense.id ? { ...item, ...expense } : item);
      saveActiveSampleData({ ...sampleData, expenses: updated });
      set({ expenses: updated });
      return expense;
    }

    if (isGuest) {
      const updated = saveGuestExpense(expense);
      set({ expenses: updated });
      return expense;
    }

    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const current = get().expenses;
    const previous = current.find((item) => sameRecord(item, expense));
    const optimistic = current.map((item) =>
      sameRecord(item, expense) ? { ...item, ...expense } : item
    );
    set({ expenses: optimistic, error: null });

    try {
      const updated = await updateExpense(uid, expense);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) return updated;
      set({
        expenses: get().expenses.map((item) =>
          sameRecord(item, expense) ? { ...item, ...updated } : item
        ),
        error: null,
      });
      return updated;
    } catch (error) {
      console.error('Failed to update expense:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
      set({
        expenses: previous
          ? get().expenses.map((item) => (sameRecord(item, expense) ? previous : item))
          : get().expenses,
        error: 'Unable to save the expense. Your changes were restored.',
      });
      throw error;
    }
  },

  deleteExpenseItem: async (uid, isGuest, expenseId) => {
    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const current = get().expenses;
    const expense = current.find((item) => item.id === expenseId) || current.find((item) => item.firestoreId === expenseId);

    if (!expense) return;

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.expenses.filter((item) => !sameRecord(item, expense));
      saveActiveSampleData({ ...sampleData, expenses: updated });
      set({ expenses: updated });
      return;
    }

    if (isGuest) {
      const updated = removeGuestExpense(expenseId);
      set({ expenses: updated });
      return;
    }

    const remaining = current.filter((item) => !sameRecord(item, expense));
    set({ expenses: remaining, error: null });

    try {
      // Nested-only records have no Firestore document to delete.
      if (expense.firestoreId) {
        await deleteExpense(uid, expense);
      }
    } catch (error) {
      console.error('Failed to delete expense:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
      set({
        expenses: get().expenses.some((item) => sameRecord(item, expense))
          ? get().expenses
          : [expense, ...get().expenses],
        error: 'Unable to delete the expense. It has been restored.',
      });
      throw error;
    }
  },
  });
});

export default useExpenseStore;
