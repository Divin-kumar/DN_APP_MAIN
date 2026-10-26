export const calendarDate = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const fixtureMoments = () => [
  { id: 'moment-one', name: 'Weekend in Ooty — family plans and memories', type: 'Vacation', date: calendarDate(5),
    activities: [{ id: 'shared', eventId: 'moment-one', title: 'Book a lakeside stay', date: calendarDate(1), priority: 'high', completed: false, createdAt: '2026-10-20T12:00:00Z',
      description: '### Travel notes\n- Bring a jacket\n- **Book early**\n\n<script>alert("literal")</script>\n![literal image](https://invalid.test/x.png)',
      expenses: [{ id: 'duplicate', amount: 999, date: '2026-10-01' }, { id: 'nested-only', name: 'Parking', amount: 20, date: '2026-09-01' }], extra: { retained: true } },
    { id: 'completed', title: 'Choose the train', completed: true, date: calendarDate(-3), priority: 'medium' },
    { id: 'cancelled', title: 'A cancelled plan', cancelled: true, date: '', priority: 'low' }],
    memories: [{ id: 'memory', title: 'Planning together', body: 'A quiet evening', createdAt: '2026-10-20T12:00:00Z' }], attachments: [] },
  { id: 'moment-two', name: 'A separate Moment', type: 'Personal', date: calendarDate(6),
    activities: [{ id: 'shared', title: 'A different activity with the same ID', date: calendarDate(2), completed: false }], memories: [], attachments: [] },
];

export async function seedGuest(page, { theme = 'dark', moments = fixtureMoments(), incomes, expenses } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ moments, incomes, expenses, theme }) => {
    if (!localStorage.getItem('dn_e2e_seeded')) {
      localStorage.setItem('dn_guest_mode', 'true');
      localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments));
      localStorage.setItem('dn_guest_incomes', JSON.stringify(incomes));
      localStorage.setItem('dn_guest_expenses', JSON.stringify(expenses));
      localStorage.setItem('dn_preferences', JSON.stringify({ theme }));
      localStorage.setItem('dn_theme_choice', theme);
      localStorage.setItem('dn_e2e_seeded', 'true');
    }
    window.__dnUrls = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const value = create(blob); window.__dnUrls.created.push(value); return value; };
    URL.revokeObjectURL = (value) => { window.__dnUrls.revoked.push(value); return revoke(value); };
  }, { moments, theme, incomes: incomes || [{ id: 'income', name: 'Trip fund', amount: 1000, date: '2026-10-25', eventId: 'moment-one', type: 'Other' }],
    expenses: expenses || [{ id: 'duplicate', name: 'Room deposit', amount: 100, date: '2026-10-24', eventId: 'moment-one', activityId: 'shared', category: 'Travel' },
      { id: 'other', name: 'Unrelated expense', amount: 8000, date: '2026-10-25', eventId: 'moment-two' }] });
  return errors;
}

export async function addOriginal(page, { width = 600, height = 900, count = 1 } = {}) {
  await page.goto('/activities');
  await page.getByRole('heading', { name: 'Activities', exact: true }).waitFor();
  return page.evaluate(async ({ width, height, count }) => {
    const { attachmentRepository } = await import('/src/services/attachmentService.js');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.fillStyle = '#315b74'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#b9d8d7'; context.fillRect(width / 4, height / 4, width / 2, height / 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const reference = await attachmentRepository.save(blob, { isGuest: true });
    const moments = JSON.parse(localStorage.getItem('dn_guest_eventGroups'));
    moments[0].attachments = [{ id: 'moment-photo', name: 'Moment-only.png', type: 'image/png', ...reference },
      ...Array.from({ length: count }, (_, index) => ({ id: `photo-${index}`, name: `Activity photo ${index}.png`, type: 'image/png',
        activityId: 'shared', size: blob.size, width, height, ...reference }))];
    localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments));
    return { ...reference, size: blob.size };
  }, { width, height, count });
}

export async function swipe(page, locator, { distance = 150, vertical = 0 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  const x = rect.x + Math.min(rect.width - 56, 220), y = rect.y + 24;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x - distance, y + vertical, { steps: 8 }); await page.mouse.up();
}

export async function openUniversalTransaction(page) {
  await page.getByRole('button', { name: 'Open quick create menu', exact: true }).click();
  await page.getByRole('button', { name: 'Transaction', exact: true }).click();
}

export async function activityDetailAction(page, name) {
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

export async function accountScope(page, uid, moments) {
  await page.evaluate(async ({ uid, moments }) => {
    const app = (await import('/src/store/useAppStore.js')).default;
    const events = (await import('/src/store/useEventStore.js')).default;
    const incomes = (await import('/src/store/useIncomeStore.js')).default;
    const expenses = (await import('/src/store/useExpenseStore.js')).default;
    const state = { loadedFor: `user:${uid}`, activeLoadKey: `user:${uid}`, loadedSample: null, activeSample: null, loading: false, error: null };
    window.__dnAccountWrites = [];
    events.setState({ ...state, events: moments, scopeRevision: events.getState().scopeRevision + 1,
      loadEvents: async () => events.getState().events,
      updateEventItem: async (owner, isGuest, moment) => {
        if (owner !== uid || isGuest) throw new Error('Wrong synthetic account write');
        window.__dnAccountWrites.push(structuredClone(moment));
        events.setState({ events: events.getState().events.map((item) => item.id === moment.id ? moment : item) });
        return moment;
      } });
    incomes.setState({ ...state, incomes: [], loadIncomes: async () => [] });
    expenses.setState({ ...state, expenses: [], pendingCreateIds: [], loadExpenses: async () => [] });
    app.setState({ user: { uid }, isGuest: false, authReady: true });
  }, { uid, moments });
}

// Exercise the replacement builder through the same existing Filters button.
export async function setActivityStatusCondition(page, status) {
  await page.getByRole('button', { name: /Filters and sort/ }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByRole('button', { name: 'Add condition', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condition field', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search fields', exact: true }).fill('Activity · Status');
  await page.getByRole('option', { name: 'Activity · Status', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condition operator', exact: true }).click();
  await page.getByRole('option', { name: 'Equals', exact: true }).click();
  await page.getByRole('combobox', { name: 'Value for Activity · Status', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search values', exact: true }).fill(status);
  await page.getByRole('option', { name: status, exact: true }).click();
  await page.getByRole('button', { name: /Filters and sort/ }).click();
}
