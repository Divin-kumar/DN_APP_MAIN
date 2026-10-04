/*
  Expense state actions keep master financial records in sync with the UI.

  This store handles all expense-related data, including loading, creating, updating, and deleting records.
*/
import { create } from 'zustand';
import { expenseRepository } from '../repositories/index.js';
import { getActiveSampleData, saveActiveSampleData } from '../dev/sampleData.js';
import { resolveRepositoryPrincipal } from './repositoryRuntime.js';

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

    const accountChanged = get().activeLoadKey && get().activeLoadKey !== loadKey;
    set({ loading: true, error: null, activeLoadKey: loadKey, ...(accountChanged ? { expenses: [] } : {}) });

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        if (sampleData) {
          if (get().activeLoadKey === loadKey) set({ expenses: sampleData.expenses, loading: false, error: null, loadedFor: loadKey });
          return sampleData.expenses;
        }

        const principalId = await resolveRepositoryPrincipal(uid, isGuest);
        if (!principalId) throw new Error('No active repository principal is available.');
        const items = await expenseRepository.getAll(principalId);

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

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = get().expenses;
    const optimistic = [normalized, ...previous];
    set({ expenses: optimistic, loading: false, error: null });

    try {
      const saved = await expenseRepository.upsert(principalId, normalized);
      set({
        expenses: [saved, ...get().expenses.filter((item) => item.id !== normalized.id && (item.firestoreId || item.id) !== (normalized.firestoreId || normalized.id))],
        error: null,
      });
      return saved;
    } catch (error) {
      console.error('Failed to create expense:', error);
      set({
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

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const current = get().expenses;
    const previous = current.find((item) => item.id === expense.id || item.firestoreId === expense.firestoreId);
    const optimistic = current.map((item) =>
      item.id === expense.id || item.firestoreId === expense.firestoreId ? { ...item, ...expense } : item
    );
    set({ expenses: optimistic, error: null });

    try {
      const updated = await expenseRepository.upsert(principalId, expense);
      set({
        expenses: get().expenses.map((item) =>
          item.id === expense.id || item.firestoreId === expense.firestoreId ? { ...item, ...updated } : item
        ),
        error: null,
      });
      return updated;
    } catch (error) {
      console.error('Failed to update expense:', error);
      set({
        expenses: previous
          ? get().expenses.map((item) => (item.id === expense.id || item.firestoreId === expense.firestoreId ? previous : item))
          : get().expenses,
        error: 'Unable to save the expense. Your changes were restored.',
      });
      throw error;
    }
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

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const remaining = current.filter((item) => item.id !== expenseId && item.firestoreId !== expenseId);
    set({ expenses: remaining, error: null });

    try {
      await expenseRepository.delete(principalId, expense.id || expenseId);
    } catch (error) {
      console.error('Failed to delete expense:', error);
      set({
        expenses: get().expenses.some((item) => item.id === expense.id || item.firestoreId === expense.firestoreId)
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
