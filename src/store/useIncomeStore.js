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

const useIncomeStore = create((set, get) => ({
  incomes: [],
  loading: false,
  error: null,

  setIncomes: (items) => set({ incomes: items, loading: false, error: null }),

  loadIncomes: async (uid, isGuest) => {
    set({ loading: true, error: null });

    try {
      const items = isGuest ? getGuestIncomes() : await getIncomesForUser(uid);
      set({ incomes: items, loading: false, error: null });
      return items;
    } catch (error) {
      console.error('Failed to load incomes:', error);
      set({ loading: false, error: 'Unable to load incomes.' });
      return [];
    }
  },

  addIncome: async (uid, isGuest, income) => {
    const normalized = {
      ...income,
      id: income.id || crypto.randomUUID(),
      amount: Number(income.amount || 0),
      date: income.date || new Date().toISOString().slice(0, 10),
    };

    if (isGuest) {
      const updated = saveGuestIncome(normalized);
      set({ incomes: updated });
      return normalized;
    }

    const saved = await createIncome(uid, normalized);
    set({ incomes: [saved, ...get().incomes] });
    return saved;
  },

  updateIncomeItem: async (uid, isGuest, income) => {
    if (isGuest) {
      const updated = saveGuestIncome(income);
      set({ incomes: updated });
      return income;
    }

    const updated = await updateIncome(uid, income);
    set({
      incomes: get().incomes.map((item) =>
        item.id === income.id || item.firestoreId === income.firestoreId ? { ...item, ...updated } : item
      ),
    });
    return updated;
  },

  deleteIncomeItem: async (uid, isGuest, incomeId) => {
    const current = get().incomes;
    const income = current.find((item) => item.id === incomeId || item.firestoreId === incomeId);

    if (!income) return;

    if (isGuest) {
      const updated = removeGuestIncome(incomeId);
      set({ incomes: updated });
      return;
    }

    await deleteIncome(uid, income);
    set({ incomes: current.filter((item) => item.id !== incomeId && item.firestoreId !== incomeId) });
  },
}));

export default useIncomeStore;
