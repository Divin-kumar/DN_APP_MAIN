const parseJsonArray = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const readLegacyGuestIncomes = () => parseJsonArray('lifehub_guest_incomes', []);

export const readLegacyIncomeRecords = () => readLegacyGuestIncomes();

export const readLegacyIncomeMeta = () => ({
  localStorageKeys: ['lifehub_guest_incomes'],
  isReadable: true,
  source: 'guest-local-storage',
});
