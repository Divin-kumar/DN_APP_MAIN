/* Expense state actions keep master financial records in sync with the UI. */
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
import { getActiveSampleData, saveActiveSampleData } from '../dev/sampleData';

const getLoadKey = (uid, isGuest) => `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;

const useExpenseStore = create((set, get) => {
  const pendingLoads = new Map();

  return ({
  expenses: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,

  setExpenses: (items) => set({ expenses: items, loading: false, error: null, loadedFor: null, activeLoadKey: null }),

  loadExpenses: async (uid, isGuest) => {
    const loadKey = getLoadKey(uid, isGuest);
    if (get().loadedFor === loadKey) return get().expenses;
    if (pendingLoads.has(loadKey)) return pendingLoads.get(loadKey);

    set({ loading: true, error: null, activeLoadKey: loadKey });

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        if (sampleData) {
          if (get().activeLoadKey === loadKey) set({ expenses: sampleData.expenses, loading: false, error: null, loadedFor: loadKey });
          return sampleData.expenses;
        }

        const items = isGuest
          ? getGuestExpenses()
          : await getExpensesForUser(uid);

        if (get().activeLoadKey === loadKey) set({ expenses: items, loading: false, error: null, loadedFor: loadKey });
        return items;
      } catch (error) {
        console.error('Failed to load expenses:', error);
        if (get().activeLoadKey === loadKey) set({ loading: false, error: 'Unable to load expenses.' });
        return [];
      } finally {
        pendingLoads.delete(loadKey);
      }
    });
    pendingLoads.set(loadKey, request);

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

    const saved = await createExpense(uid, normalized);
    const current = get().expenses;
    set({ expenses: [saved, ...current] });
    return saved;
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

    const updated = await updateExpense(uid, expense);
    set({
      expenses: get().expenses.map((item) =>
        item.id === expense.id || item.firestoreId === expense.firestoreId ? { ...item, ...updated } : item
      ),
    });
    return updated;
  },

  deleteExpenseItem: async (uid, isGuest, expenseId) => {
    const current = get().expenses;
    const expense = current.find((item) => item.id === expenseId || item.firestoreId === expenseId);

    if (!expense) return;

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.expenses.filter((item) => item.id !== expenseId && item.firestoreId !== expenseId);
      saveActiveSampleData({ ...sampleData, expenses: updated });
      set({ expenses: updated });
      return;
    }

    if (isGuest) {
      const updated = removeGuestExpense(expenseId);
      set({ expenses: updated });
      return;
    }

    // Nested-only records have no Firestore document to delete.
    if (expense.firestoreId) {
      await deleteExpense(uid, expense);
    }
    set({ expenses: current.filter((item) => item.id !== expenseId && item.firestoreId !== expenseId) });
  },
  });
});

export default useExpenseStore;
