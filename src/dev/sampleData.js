// This file creates realistic demo data for development and testing.
// It lets the app behave like it has real events, incomes, expenses, memories, and attachments without needing live backend data.
const ACTIVE_SCENARIO_KEY = 'lifehub_dev_fixture_scenario';
const FIXTURE_DATA_KEY = 'lifehub_dev_fixture_data';
const ANCHOR_DATE = new Date();
ANCHOR_DATE.setHours(12, 0, 0, 0);

const scenarioDefinitions = {
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
  if (!import.meta.env.DEV || uid || typeof localStorage === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SCENARIO_KEY) || null;
};

export const getActiveSampleData = (uid) => {
  const scenario = getActiveSampleScenario(uid);
  if (!scenario) return null;
  try {
    const data = JSON.parse(localStorage.getItem(FIXTURE_DATA_KEY) || 'null');
    return data?.scenario === scenario ? data : null;
  } catch {
    return null;
  }
};

export const activateSampleScenario = (scenario) => {
  if (!import.meta.env.DEV) throw new Error('Sample data is available only in development builds.');
  const data = makeDataset(scenario);
  localStorage.setItem(FIXTURE_DATA_KEY, JSON.stringify(data));
  localStorage.setItem(ACTIVE_SCENARIO_KEY, scenario);
  return data;
};

export const saveActiveSampleData = (data) => {
  if (!import.meta.env.DEV || !getActiveSampleScenario()) throw new Error('No isolated sample session is active.');
  localStorage.setItem(FIXTURE_DATA_KEY, JSON.stringify(data));
  return data;
};

export const clearActiveSampleScenario = () => {
  if (!import.meta.env.DEV) return;
  localStorage.removeItem(ACTIVE_SCENARIO_KEY);
  localStorage.removeItem(FIXTURE_DATA_KEY);
};

export const getSampleScenarioLabel = (scenario) => scenarioDefinitions[scenario]?.label || scenario;
