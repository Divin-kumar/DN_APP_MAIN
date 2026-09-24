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

const useExpenseStore = create((set, get) => ({
  expenses: [],
  loading: false,
  error: null,

  setExpenses: (items) => set({ expenses: items, loading: false, error: null }),

  loadExpenses: async (uid, isGuest) => {
    set({ loading: true, error: null });

    try {
      const items = isGuest
        ? getGuestExpenses()
        : await getExpensesForUser(uid);

      set({ expenses: items, loading: false, error: null });
      return items;
    } catch (error) {
      console.error('Failed to load expenses:', error);
      set({ loading: false, error: 'Unable to load expenses.' });
      return [];
    }
  },

  addExpense: async (uid, isGuest, expense) => {
    const normalized = {
      ...expense,
      id: expense.id || crypto.randomUUID(),
      amount: Number(expense.amount || 0),
      date: expense.date || new Date().toISOString().slice(0, 10),
    };

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
}));

export default useExpenseStore;
