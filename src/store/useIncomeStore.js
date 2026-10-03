/*
  Income state actions keep persisted entries and summaries synchronized.

  This store is responsible for all income data the app tracks, including reading from storage and saving changes.
*/
import { create } from 'zustand';
import {
  createIncome,
  deleteIncome,
  getGuestIncomes,
  getIncomesForUser,
  removeGuestIncome,
  saveGuestIncome,
  updateIncome,
} from '../services/incomeService';
import { getActiveSampleData, saveActiveSampleData } from '../dev/sampleData';

const getLoadKey = (uid, isGuest) => `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;

const useIncomeStore = create((set, get) => {
  const pendingLoads = new Map();

  return ({
  incomes: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,

  setIncomes: (items) => set({ incomes: items, loading: false, error: null, loadedFor: null, activeLoadKey: null }),

  loadIncomes: async (uid, isGuest) => {
    const loadKey = getLoadKey(uid, isGuest);
    if (get().loadedFor === loadKey) return get().incomes;
    if (pendingLoads.has(loadKey)) return pendingLoads.get(loadKey);

    const accountChanged = get().activeLoadKey && get().activeLoadKey !== loadKey;
    set({ loading: true, error: null, activeLoadKey: loadKey, ...(accountChanged ? { incomes: [] } : {}) });

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        const items = sampleData
          ? sampleData.incomes
          : isGuest ? getGuestIncomes() : await getIncomesForUser(uid);
        if (get().activeLoadKey === loadKey) {
          set({ incomes: items, loading: false, error: null, loadedFor: loadKey });
        }
        return items;
      } catch (error) {
        console.error('Failed to load incomes:', error);
        if (get().activeLoadKey === loadKey) set({ loading: false, error: 'Unable to load incomes.' });
        return [];
      } finally {
        pendingLoads.delete(loadKey);
      }
    });
    pendingLoads.set(loadKey, request);
    return request;
  },

  addIncome: async (uid, isGuest, income) => {
    const normalized = {
      ...income,
      id: income.id || crypto.randomUUID(),
      amount: Number(income.amount || 0),
      date: income.date || new Date().toISOString().slice(0, 10),
    };

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = [normalized, ...sampleData.incomes];
      saveActiveSampleData({ ...sampleData, incomes: updated });
      set({ incomes: updated });
      return normalized;
    }

    if (isGuest) {
      const updated = saveGuestIncome(normalized);
      set({ incomes: updated });
      return normalized;
    }

    const previous = get().incomes;
    const optimistic = [normalized, ...previous];
    set({ incomes: optimistic, error: null });

    try {
      const saved = await createIncome(uid, normalized);
      set({
        incomes: [saved, ...get().incomes.filter((item) => item.id !== normalized.id && (item.firestoreId || item.id) !== (normalized.firestoreId || normalized.id))],
        error: null,
      });
      return saved;
    } catch (error) {
      console.error('Failed to create income:', error);
      set({
        incomes: get().incomes.filter((item) => item.id !== normalized.id && item.firestoreId !== normalized.id),
        error: 'Unable to create the income. Your changes were restored.',
      });
      throw error;
    }
  },

  updateIncomeItem: async (uid, isGuest, income) => {
    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.incomes.map((item) => item.id === income.id ? { ...item, ...income } : item);
      saveActiveSampleData({ ...sampleData, incomes: updated });
      set({ incomes: updated });
      return income;
    }

    if (isGuest) {
      const updated = saveGuestIncome(income);
      set({ incomes: updated });
      return income;
    }

    const current = get().incomes;
    const previous = current.find((item) => item.id === income.id || item.firestoreId === income.firestoreId);
    const optimistic = current.map((item) =>
      item.id === income.id || item.firestoreId === income.firestoreId ? { ...item, ...income } : item
    );
    set({ incomes: optimistic, error: null });

    try {
      const updated = await updateIncome(uid, income);
      set({
        incomes: get().incomes.map((item) =>
          item.id === income.id || item.firestoreId === income.firestoreId ? { ...item, ...updated } : item
        ),
        error: null,
      });
      return updated;
    } catch (error) {
      console.error('Failed to update income:', error);
      set({
        incomes: previous
          ? get().incomes.map((item) => (item.id === income.id || item.firestoreId === income.firestoreId ? previous : item))
          : get().incomes,
        error: 'Unable to save the income. Your changes were restored.',
      });
      throw error;
    }
  },

  deleteIncomeItem: async (uid, isGuest, incomeId) => {
    const current = get().incomes;
    const income = current.find((item) => item.id === incomeId || item.firestoreId === incomeId);

    if (!income) return;

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.incomes.filter((item) => item.id !== incomeId && item.firestoreId !== incomeId);
      saveActiveSampleData({ ...sampleData, incomes: updated });
      set({ incomes: updated });
      return;
    }

    if (isGuest) {
      const updated = removeGuestIncome(incomeId);
      set({ incomes: updated });
      return;
    }

    const remaining = current.filter((item) => item.id !== incomeId && item.firestoreId !== incomeId);
    set({ incomes: remaining, error: null });

    try {
      await deleteIncome(uid, income);
    } catch (error) {
      console.error('Failed to delete income:', error);
      set({
        incomes: get().incomes.some((item) => item.id === income.id || item.firestoreId === income.firestoreId)
          ? get().incomes
          : [income, ...get().incomes],
        error: 'Unable to delete the income. It has been restored.',
      });
      throw error;
    }
  },
  });
});

export default useIncomeStore;
