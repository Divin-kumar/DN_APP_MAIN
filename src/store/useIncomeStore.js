import { formatMomentDate } from '../utils/momentDates';
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
import { requireActiveSampleData as getActiveSampleData, getActiveSampleScenario, saveActiveSampleData } from '../dev/sampleData';
import { sameRecord } from '../utils/transactionRelations';
import { beginFinancialLoad, isFinancialScopeLoaded } from '../utils/financialLoadScope';

const getLoadKey = (uid, isGuest) => `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;

const useIncomeStore = create((set, get) => {
  const pendingLoads = new Map();

  return ({
  incomes: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,
  loadedSample: null, activeSample: null, scopeRevision: 0,

  setIncomes: (items) => set((state) => ({ incomes: items, loading: false, error: null, loadedFor: null, activeLoadKey: null,
    loadedSample: null, activeSample: null, scopeRevision: state.scopeRevision + 1 })),

  loadIncomes: async (uid, isGuest) => {
    const loadKey = getLoadKey(uid, isGuest);
    const sample = getActiveSampleScenario(uid);
    const requestKey = JSON.stringify([loadKey, sample]);
    if (isFinancialScopeLoaded(get(), loadKey) && (get().loadedSample ?? null) === sample && (get().activeSample ?? null) === sample) return get().incomes;
    const changed = get().activeLoadKey !== loadKey || (get().activeSample ?? null) !== sample;
    set({ ...beginFinancialLoad(get(), loadKey, 'incomes'), activeSample: sample,
      ...(changed ? { incomes: [], loadedFor: null, loadedSample: null, scopeRevision: get().scopeRevision + 1 } : {}) });
    // Re-select an in-flight account when rapidly switching A → B → A.
    if (pendingLoads.has(requestKey)) return pendingLoads.get(requestKey);

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        const items = sampleData
          ? sampleData.incomes
          : isGuest ? getGuestIncomes() : await getIncomesForUser(uid);
        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) {
          set({ incomes: items, loading: false, error: null, loadedFor: loadKey, loadedSample: sample });
        }
        return items;
      } catch (error) {
        console.error('Failed to load incomes:', error);
        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ loading: false, error: 'Unable to load incomes.' });
        return [];
      } finally {
        pendingLoads.delete(requestKey);
      }
    });
    pendingLoads.set(requestKey, request);
    return request;
  },

  addIncome: async (uid, isGuest, income) => {
    const normalized = {
      ...income,
      id: income.id || crypto.randomUUID(),
      amount: Number(income.amount || 0),
      date: income.date || formatMomentDate(new Date()),
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

    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const previous = get().incomes;
    const optimistic = [normalized, ...previous];
    set({ incomes: optimistic, error: null });

    try {
      const saved = await createIncome(uid, normalized);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) return saved;
      set({
        incomes: [saved, ...get().incomes.filter((item) => item.id !== normalized.id && (item.firestoreId || item.id) !== (normalized.firestoreId || normalized.id))],
        error: null,
      });
      return saved;
    } catch (error) {
      console.error('Failed to create income:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
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

    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const current = get().incomes;
    const previous = current.find((item) => sameRecord(item, income));
    const optimistic = current.map((item) =>
      sameRecord(item, income) ? { ...item, ...income } : item
    );
    set({ incomes: optimistic, error: null });

    try {
      const updated = await updateIncome(uid, income);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) return updated;
      set({
        incomes: get().incomes.map((item) =>
          sameRecord(item, income) ? { ...item, ...updated } : item
        ),
        error: null,
      });
      return updated;
    } catch (error) {
      console.error('Failed to update income:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
      set({
        incomes: previous
          ? get().incomes.map((item) => (sameRecord(item, income) ? previous : item))
          : get().incomes,
        error: 'Unable to save the income. Your changes were restored.',
      });
      throw error;
    }
  },

  deleteIncomeItem: async (uid, isGuest, incomeId) => {
    const mutationScope = get().activeLoadKey;
    const mutationRevision = get().scopeRevision;
    const current = get().incomes;
    const income = current.find((item) => item.id === incomeId) || current.find((item) => item.firestoreId === incomeId);

    if (!income) return;

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.incomes.filter((item) => !sameRecord(item, income));
      saveActiveSampleData({ ...sampleData, incomes: updated });
      set({ incomes: updated });
      return;
    }

    if (isGuest) {
      const updated = removeGuestIncome(incomeId);
      set({ incomes: updated });
      return;
    }

    const remaining = current.filter((item) => !sameRecord(item, income));
    set({ incomes: remaining, error: null });

    try {
      await deleteIncome(uid, income);
    } catch (error) {
      console.error('Failed to delete income:', error);
      if (get().activeLoadKey !== mutationScope || get().scopeRevision !== mutationRevision) throw error;
      set({
        incomes: get().incomes.some((item) => sameRecord(item, income))
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
