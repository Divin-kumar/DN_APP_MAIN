import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
// This file creates realistic demo data for development and testing.
// It lets the app behave like it has real events, incomes, expenses, memories, and attachments without needing live backend data.
const ACTIVE_SCENARIO_KEY = 'dn_dev_fixture_scenario';
export const GUEST_TOUR_SCENARIO = 'tour';
export const GUEST_TOUR_VERSION = '2026.10.28.1';
const TOUR_DISMISSED_KEY = 'dn_guest_tour_declined';
const FIXTURE_DATA_KEY = 'dn_dev_fixture_data';
const ANCHOR_DATE = new Date();
ANCHOR_DATE.setHours(12, 0, 0, 0);

const scenarioDefinitions = {
  tour: { events: 3, activities: 12, memories: 2, attachments: 7, incomes: 2, expenses: 3, label: 'Explore DN · guided demo' },
  empty: { events: 0, activities: 0, memories: 0, attachments: 0, incomes: 0, expenses: 0, label: 'Empty state' },
  new: { events: 3, activities: 6, memories: 3, attachments: 2, incomes: 3, expenses: 8, label: 'New user' },
  regular: { events: 60, activities: 360, memories: 240, attachments: 180, incomes: 72, expenses: 600, label: 'Regular · 5 years' },
  power: { events: 90, activities: 450, memories: 405, attachments: 270, incomes: 120, expenses: 900, label: 'Power user' },
  financial: { events: 75, activities: 300, memories: 225, attachments: 225, incomes: 120, expenses: 1800, label: 'Heavy financial' },
  'long-term': { events: 65, activities: 390, memories: 325, attachments: 195, incomes: 120, expenses: 780, label: 'Long-term · 6 years' },
};

const eventTypes = [
  'Birthday', 'Marriage Anniversary', 'Wedding', 'Engagement', 'Vacation', 'Family Gathering',
  'House Purchase', 'Home Renovation', 'Car Purchase', 'Insurance Renewal', 'Medical Checkup',
  'Education', 'Certification', 'Promotion', 'Job Change', 'Investment', 'Festival',
  'Retirement Planning', 'Personal Goal', 'Other',
];
const eventNames = [
  'A birthday worth celebrating', 'Our anniversary', 'A new chapter together', 'The big question',
  'Coastal weekend away', 'Sunday with the family', 'A place to call home', 'Making the kitchen ours',
  'First long drive', 'Annual cover review', 'A little time for health', 'A new course begins',
  'Professional certification', 'A well-earned promotion', 'A fresh career chapter', 'First investment milestone',
  'Festival of lights together', 'Future planning afternoon', 'A promise to myself', 'A day to remember',
];
const activityTitles = [
  'Book a table for the celebration', 'Choose a thoughtful gift', 'Save the photographs', 'Call the people we love',
  'Confirm the travel booking', 'Collect the important documents', 'Schedule the appointment', 'Review the plan together',
  'Pay the final invoice', 'Write down what I want to remember', 'Share the update with family', 'Add the little details',
  'Take a quiet moment to reflect', 'Renew the paperwork', 'Make time for a first visit', 'Prepare a small surprise',
  'Save the certificate safely', 'Plan the next step', 'Choose a date that works', 'Capture a note for later',
];
const memoryTitles = ['The moment everything changed', 'A detail I want to remember', 'A story from that day', 'The people who made it special', 'A quiet moment together', 'What I learned along the way', 'A photograph in words', 'One for the family archive'];
const memoryBodies = [
  'The light was soft, everyone stayed a little longer, and the day felt exactly like us.',
  'We laughed about it on the way home. It is the sort of small detail that makes this memory ours.',
  'A milestone made more meaningful by the people who showed up and shared it with us.',
  'I want to remember the feeling, not just the date: hopeful, present, and surrounded by kindness.',
  'The photos will help, but this is the story behind the one everyone keeps asking about.',
];
const attachmentNames = [
  ['family-celebration.jpg', 'image/jpeg'], ['booking-confirmation.pdf', 'application/pdf'],
  ['signed-agreement.pdf', 'application/pdf'], ['insurance-renewal.pdf', 'application/pdf'],
  ['course-certificate.pdf', 'application/pdf'], ['clinic-summary.pdf', 'application/pdf'],
  ['travel-itinerary.pdf', 'application/pdf'], ['housewarming-photo.jpg', 'image/jpeg'],
  ['invoice-final.pdf', 'application/pdf'], ['memory-video.mp4', 'video/mp4'],
];
const expenseCategories = ['Travel', 'Food', 'Gifts', 'Health', 'Insurance', 'Education', 'Home', 'Vehicle', 'Celebrations', 'Other'];
const expenseNames = ['Weekend accommodation', 'Family dinner', 'Thoughtful gift', 'Annual health visit', 'Policy renewal', 'Course materials', 'Home supplies', 'Vehicle service', 'Celebration flowers', 'Travel booking'];
const incomeTypes = ['Salary', 'Bonus', 'Interest', 'Investment returns', 'Freelance'];

const seededId = (scenario, kind, index) => `demo-${scenario}-${kind}-${String(index + 1).padStart(4, '0')}`;
const dateString = (date) => new Date(date).toISOString().slice(0, 10);
const monthOffset = (date, amount) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};
const dayOffset = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const timestamp = (date, hour = 12) => {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
};

function eventDate(index, scenario) {
  if (scenario === 'new') return dateString(dayOffset(ANCHOR_DATE, index * 21 - 14));
  const horizonMonths = scenario === 'regular' ? 60 : 72;
  const monthsBack = (index * 7) % horizonMonths;
  const date = monthOffset(ANCHOR_DATE, -monthsBack);
  date.setDate(3 + ((index * 11) % 26));
  if (index % 13 === 0) return dateString(dayOffset(ANCHOR_DATE, 4 + (index % 20)));
  if (index % 17 === 0) return dateString(dayOffset(ANCHOR_DATE, -2 - (index % 25)));
  return dateString(date);
}

function makeEvents(scenario, counts) {
  const events = [];
  for (let index = 0; index < counts.events; index += 1) {
    const id = seededId(scenario, 'event', index);
    const type = eventTypes[index % eventTypes.length];
    const date = eventDate(index, scenario);
    const eventCreated = monthOffset(new Date(`${date}T12:00:00`), -Math.min(index % 20, 20));
    if (eventCreated > ANCHOR_DATE) eventCreated.setTime(ANCHOR_DATE.getTime());
    const event = {
      id,
      name: `${eventNames[index % eventNames.length]}${index >= eventNames.length ? ` ${Math.floor(index / eventNames.length) + 1}` : ''}`,
      date,
      type,
      customType: type === 'Other' ? 'Career milestone' : '',
      recurrence: ['Birthday', 'Marriage Anniversary', 'Insurance Renewal', 'Festival'].includes(type) ? 'yearly' : 'none',
      budget: 12000 + ((index * 7823) % 275000),
      notes: `${memoryBodies[index % memoryBodies.length]} ${type} · ${date.slice(0, 4)}.`,
      activities: [],
      memories: [],
      attachments: [],
      createdAt: timestamp(eventCreated, 10),
    };
    events.push(event);
  }
  return events;
}

function makeDataset(scenario) {
  if (scenario === GUEST_TOUR_SCENARIO) return buildGuestTourDataset();
  const counts = scenarioDefinitions[scenario];
  if (!counts) throw new Error(`Unknown sample data scenario: ${scenario}`);
  const events = makeEvents(scenario, counts);
  const activities = [];
  const memories = [];
  const attachments = [];
  const incomes = [];
  const expenses = [];

  for (let index = 0; index < counts.activities; index += 1) {
    const event = events[index % Math.max(events.length, 1)];
    if (!event) break;
    const statusIndex = index % 10;
    const completed = statusIndex < (scenario === 'new' ? 2 : 4);
    const dueDate = dateString(dayOffset(new Date(`${event.date}T12:00:00`), (index % 13) - 5));
    const priority = ['high', 'medium', 'low'][index % 3];
    const completedDate = dayOffset(new Date(`${dueDate}T12:00:00`), -(index % 9));
    if (completedDate > ANCHOR_DATE) completedDate.setTime(ANCHOR_DATE.getTime());
    const activityCreated = dayOffset(new Date(`${dueDate}T12:00:00`), -7 - (index % 35));
    if (activityCreated > ANCHOR_DATE) activityCreated.setTime(ANCHOR_DATE.getTime());
    const activity = {
      id: seededId(scenario, 'activity', index),
      eventId: event.id,
      title: activityTitles[index % activityTitles.length],
      date: dueDate,
      description: index % 4 === 0 ? 'A small next step connected to this life moment.' : '',
      completed,
      completedAt: completed ? timestamp(completedDate, 16) : null,
      priority,
      expenses: [],
      createdAt: timestamp(activityCreated, 9),
    };
    event.activities.push(activity);
    activities.push(activity);
  }

  for (let index = 0; index < counts.memories; index += 1) {
    const event = events[index % Math.max(events.length, 1)];
    if (!event) break;
    const created = monthOffset(new Date(`${event.date}T12:00:00`), index % 13);
    if (created > ANCHOR_DATE) created.setTime(ANCHOR_DATE.getTime());
    const memory = {
      id: seededId(scenario, 'memory', index),
      title: memoryTitles[index % memoryTitles.length],
      body: memoryBodies[index % memoryBodies.length],
      kind: ['note', 'story', 'reflection', 'milestone', 'photo', 'video'][index % 6],
      createdAt: timestamp(created, 18),
    };
    event.memories.push(memory);
    memories.push(memory);
  }

  for (let index = 0; index < counts.attachments; index += 1) {
    const event = events[index % Math.max(events.length, 1)];
    if (!event) break;
    const [name, type] = attachmentNames[index % attachmentNames.length];
    const attachedAt = monthOffset(new Date(`${event.date}T12:00:00`), index % 9);
    if (attachedAt > ANCHOR_DATE) attachedAt.setTime(ANCHOR_DATE.getTime());
    const attachment = {
      id: seededId(scenario, 'attachment', index),
      name: `${String(index + 1).padStart(3, '0')}-${name}`,
      type,
      size: 180_000 + ((index * 97_531) % 4_500_000),
      createdAt: timestamp(attachedAt, 11),
    };
    event.attachments.push(attachment);
    attachments.push(attachment);
  }

  for (let index = 0; index < counts.incomes; index += 1) {
    const date = monthOffset(ANCHOR_DATE, -((index * 5) % 72));
    date.setDate(1 + (index % 26));
    incomes.push({
      id: seededId(scenario, 'income', index),
      name: `${incomeTypes[index % incomeTypes.length]}${index % 4 === 0 ? ' · annual' : ''}`,
      type: incomeTypes[index % incomeTypes.length],
      amount: [72000, 98000, 12500, 36000, 18500][index % 5] + ((index * 173) % 9000),
      date: dateString(date),
      createdAt: timestamp(date, 8),
    });
  }

  for (let index = 0; index < counts.expenses; index += 1) {
    const event = events[(index * 7) % Math.max(events.length, 1)];
    if (!event) break;
    const activity = event.activities.length ? event.activities[index % event.activities.length] : null;
    const date = monthOffset(ANCHOR_DATE, -(index % 72));
    date.setDate(1 + (index % 26));
    expenses.push({
      id: seededId(scenario, 'expense', index),
      name: expenseNames[index % expenseNames.length],
      amount: [850, 1450, 2800, 6400, 12000, 24500, 3900, 7800][index % 8] + ((index * 79) % 1700),
      category: expenseCategories[index % expenseCategories.length],
      description: `Sample ${expenseCategories[index % expenseCategories.length].toLowerCase()} expense linked to ${event.name}.`,
      date: dateString(date),
      createdAt: timestamp(date, 14),
      eventId: event.id,
      activityId: activity?.id || null,
      source: activity ? 'event-activity' : 'manual',
    });
  }

  return { scenario, generatedAt: timestamp(ANCHOR_DATE), anchorDate: dateString(ANCHOR_DATE), events, activities, memories, attachments, incomes, expenses };
}

export const getSampleScenarioDefinitions = () => scenarioDefinitions;

export const getActiveSampleScenario = (uid) => {
  if (uid || typeof localStorage === 'undefined') return null;
  try { const scenario = localStorage.getItem(ACTIVE_SCENARIO_KEY);
    return import.meta.env.DEV || scenario === GUEST_TOUR_SCENARIO ? scenario : null; }
  catch { return null; }
};

export const getActiveSampleData = (uid) => {
  const scenario = getActiveSampleScenario(uid);
  if (!scenario) return null;
  try {
    const data = JSON.parse(localStorage.getItem(FIXTURE_DATA_KEY) || 'null');
    return data?.scenario === scenario && ['events', 'incomes', 'expenses'].every((key) => Array.isArray(data[key])) ? data : null;
  } catch {
    return null;
  }
};

// Stores must never fall through to real Guest persistence when an active
// isolated fixture is missing/corrupt. Settings can still offer Clear Sample.
export const requireActiveSampleData = (uid) => {
  const data = getActiveSampleData(uid);
  if (getActiveSampleScenario(uid) && (!data || !['events', 'incomes', 'expenses'].every((key) => Array.isArray(data[key])))) {
    throw new Error('The isolated Sample data is unavailable. Clear Sample data or reload it before saving.');
  }
  return data;
};

export const activateSampleScenario = (scenario) => {
  if (!import.meta.env.DEV && scenario !== GUEST_TOUR_SCENARIO) throw new Error('Development samples are only available in development builds.');
  const data = makeDataset(scenario);
  localStorage.setItem(FIXTURE_DATA_KEY, JSON.stringify(data));
  localStorage.setItem(ACTIVE_SCENARIO_KEY, scenario);
  return data;
};

export const saveActiveSampleData = (data) => {
  if (!getActiveSampleScenario() || (!import.meta.env.DEV && getActiveSampleScenario() !== GUEST_TOUR_SCENARIO)) throw new Error('No isolated sample session is active.');
  localStorage.setItem(FIXTURE_DATA_KEY, JSON.stringify(data));
  return data;
};

export const clearActiveSampleScenario = () => {
  if (!import.meta.env.DEV && getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return;
  [ACTIVE_SCENARIO_KEY, FIXTURE_DATA_KEY].forEach((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(LEGACY_STORAGE_PREFIX + key.slice(DN_STORAGE_PREFIX.length));
  });
};

export const getSampleScenarioLabel = (scenario) => scenarioDefinitions[scenario]?.label || scenario;


export function buildGuestTourDataset(reference = ANCHOR_DATE) {
  const date = (n) => dateString(dayOffset(reference, n));
  const activity = (id, eventId, title, offset, description, status = 'completed') => ({
    id: 'dn-tour-activity-' + id, eventId, title, date: date(offset), description,
    status, completed: status === 'completed', cancelled: status === 'cancelled',
    priority: 'medium', expenses: [],
  });
  const j = 'dn-tour-journal', d = 'dn-tour-diary', t = 'dn-tour-tasks';
  const events = [{
    id: j, name: 'Explore DN · Our little getaway', type: 'Vacation', date: date(-24),
    notes: 'Welcome to Journal. Save photographs, stories and moments together. Open Summary then Customize PDF for your memory book.',
    attachments: [], memories: [{ id: 'dn-tour-memory-1', title: 'Why we keep photos',
      body: 'Pictures hold the scene. Our words hold the feeling.' }],
    activities: [
      activity('j1', j, 'The road to the hills', -24, 'We left early while the world was quiet. The first cup of tea and winding road became our favourite part of the trip.'),
      activity('j2', j, 'A walk before sunset', -23, 'The light shifted over the hills. Every turn revealed another view worth remembering.'),
      activity('j3', j, 'One last photograph', -22, 'A picture of the colours that made the weekend unforgettable.'),
    ],
  }, {
    id: d, name: 'Explore DN · This month in words', type: 'Diary', date: date(-6),
    notes: 'One Moment per month. Write as much as you want: pictures are optional, and the Diary PDF is for reading.',
    attachments: [], memories: [], activities: [
      activity('d1', d, 'A quiet Monday', -6, 'Today I noticed how much better my mornings feel with a slower start. Three things I am grateful for, and one idea I want to follow.'),
      activity('d2', d, 'What I learned', -3, 'Listening changed a difficult conversation. This is the sort of detail I would otherwise forget.'),
      activity('d3', d, 'A promise to myself', -1, 'Take a walk, call an old friend, and leave a little more room for the things that matter.'),
    ],
  }, {
    id: t, name: 'Explore DN · Home project', type: 'Project', date: date(-4),
    notes: 'Try changing a task status. In progress comes first, then Completed, then Cancelled. Dates sort within each group.',
    attachments: [], memories: [{ id: 'dn-tour-memory-2', title: 'The original plan', body: 'Older notes remain readable reflections.' }],
    activities: [
      activity('t1', t, 'Choose a paint colour', -4, 'Compare two options.', 'completed'),
      activity('t2', t, 'Book the electrician', 2, 'Confirm appointment and cost.', 'in-progress'),
      activity('t3', t, 'Buy lamps for the study', 5, 'Make a shortlist.', 'in-progress'),
      activity('t4', t, 'Replace old shelves', -1, 'No longer needed.', 'cancelled'),
      activity('t5', t, 'Measure the window', -2, 'Save the dimensions.', 'completed'),
      activity('t6', t, 'Plan weekend clean-up', 7, 'Keep the afternoon free.', 'in-progress'),
    ],
  }];
  const incomes = [
    { id: 'dn-tour-income-1', name: 'Project fund', type: 'Other', amount: 12500, paymentMethod: 'Online', date: date(-5) },
    { id: 'dn-tour-income-2', name: 'Small refund', type: 'Other', amount: 450, paymentMethod: 'Cash', date: date(-2) },
  ];
  const expenses = [
    { id: 'dn-tour-expense-1', name: 'Weekend stay', category: 'Travel', amount: 2600, paymentMethod: 'Online', eventId: j, activityId: 'dn-tour-activity-j1', date: date(-24) },
    { id: 'dn-tour-expense-2', name: 'Coffee on the road', category: 'Food', amount: 190, paymentMethod: 'Cash', eventId: j, activityId: 'dn-tour-activity-j1', date: date(-24) },
    { id: 'dn-tour-expense-3', name: 'Paint samples', category: 'Home', amount: 340, paymentMethod: 'Online', eventId: t, activityId: 'dn-tour-activity-t1', date: date(-4) },
  ];
  return { scenario: GUEST_TOUR_SCENARIO, demoVersion: GUEST_TOUR_VERSION,
    generatedAt: reference.toISOString(), anchorDate: date(0), events,
    activities: events.flatMap((event) => event.activities),
    memories: events.flatMap((event) => event.memories), attachments: [],
    incomes, expenses, imagesReady: false };
}
export const canOfferGuestTour = () => {
  if (typeof localStorage === 'undefined' || localStorage.getItem(TOUR_DISMISSED_KEY)) return false;
  return ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].every((key) => {
    const value = localStorage.getItem(key);
    if (value === null) return true;
    try { const records = JSON.parse(value); return Array.isArray(records) && records.length === 0; }
    catch { return false; }
  });
};
export const guestTourNeedsUpdate = () => {
  const data = getActiveSampleData();
  return data?.scenario === GUEST_TOUR_SCENARIO && data.demoVersion !== GUEST_TOUR_VERSION;
};
export const markGuestTourDeclined = () => localStorage.setItem(TOUR_DISMISSED_KEY, 'true');
export const clearGuestTourDeclined = () => localStorage.removeItem(TOUR_DISMISSED_KEY);

// Offline illustrative demo photos are saved as real, scoped originals in
// IndexedDB, not fabricated attachment URLs or remote stock photography.
export async function hydrateGuestTourPhotos() {
  if (getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return null;
  const data = getActiveSampleData();
  if (!data || data.imagesReady) return data;
  const { attachmentRepository } = await import('../services/attachmentService.js');
  const layouts = [
    ['Weekend cover', null, 920, 570, 195],
    ['First morning', 'dn-tour-activity-j1', 650, 820, 182],
    ['Mountain road', 'dn-tour-activity-j1', 850, 525, 205],
    ['Sunset walk', 'dn-tour-activity-j2', 860, 520, 30],
    ['Blue sky', 'dn-tour-activity-j2', 540, 740, 205],
    ['Sunset colours', 'dn-tour-activity-j2', 870, 540, 18],
    ['Last view', 'dn-tour-activity-j3', 860, 515, 165],
  ];
  const photos = [];
  for (const [index, [name, activityId, width, height, hue]] of layouts.entries()) {
    if (getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot create demo illustrations.');
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'hsl(' + hue + ',55%,70%)');
    gradient.addColorStop(1, 'hsl(' + (hue + 18) + ',40%,25%)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,239,198,.82)';
    ctx.beginPath(); ctx.arc(width*.78, height*.23, width*.085, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(33,69,77,.55)';
    ctx.beginPath(); ctx.moveTo(0,height*.86); ctx.lineTo(width*.35,height*.37);
    ctx.lineTo(width*.64,height*.78); ctx.lineTo(width,height*.42);
    ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.fill();
    ctx.fillStyle = 'rgba(15,49,50,.58)';
    ctx.beginPath(); ctx.moveTo(0,height*.94);ctx.lineTo(width*.55,height*.61);
    ctx.lineTo(width,height*.86);ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(width*.033) + 'px Georgia';
    ctx.fillText(name, 28, height - 40);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .77));
    if (!blob) throw new Error('Could not prepare a Guest tour photo.');
    const reference = await attachmentRepository.save(blob, { isGuest: true, sample: true,
      assertCurrent: () => { if (getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) throw new Error('Guest tour ended.'); } });
    photos.push({ id: 'dn-tour-photo-' + (index + 1), name: name + '.jpg',
      type: 'image/jpeg', size: blob.size, width, height, ...reference,
      ...(activityId ? { activityId } : {}) });
  }
  if (getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return null;
  const current = getActiveSampleData();
  if (!current) return null;
  const events = current.events.map((event) => event.id === 'dn-tour-journal'
    ? { ...event, attachments: [...(event.attachments || []).filter((photo) => !photo.id?.startsWith('dn-tour-photo-')), ...photos] }
    : event);
  const next = { ...current, events, imagesReady: true,
    attachments: events.flatMap((event) => event.attachments || []) };
  saveActiveSampleData(next);
  return next;
}
