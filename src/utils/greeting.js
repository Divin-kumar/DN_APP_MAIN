const getEventDate = (event) => {
  const date = new Date(event?.date || event?.startDate || event?.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isRecurringEvent = (event) => Boolean(event?.isRecurring === true || (event?.recurrence && String(event.recurrence).toLowerCase() !== 'none'));
const startOfDay = (date) => { const next = new Date(date); next.setHours(0, 0, 0, 0); return next; };
const formatDate = (date) => date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Date not set';

const nextOccurrence = (event, referenceDate = new Date()) => {
  const baseDate = getEventDate(event);
  if (!baseDate || !isRecurringEvent(event)) return baseDate;
  const today = startOfDay(referenceDate);
  const recurrence = String(event.recurrence || 'yearly').toLowerCase();
  if (recurrence === 'monthly') {
    const candidate = new Date(today.getFullYear(), today.getMonth(), baseDate.getDate());
    return candidate < today ? new Date(today.getFullYear(), today.getMonth() + 1, baseDate.getDate()) : candidate;
  }
  const candidate = new Date(today.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  return candidate < today ? new Date(today.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate()) : candidate;
};

const ordinal = (value) => {
  const number = Number(value);
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
};

const greetingName = (event) => String(event?.personName || event?.contactName || event?.name || 'You')
  .replace(/\b(birthday|anniversary)\b/gi, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'You';

const resolveTemplate = (eventType, templates) => {
  const type = String(eventType || '').trim();
  if (templates[type]) return templates[type];
  const match = Object.entries(templates).find(([key]) => key.toLowerCase() === type.toLowerCase());
  return match?.[1] || null;
};

const renderTemplate = (template, replacements) => String(template || '').replace(/\{([^}]+)\}/g, (match, key) => {
  const normalized = String(key).trim().toLowerCase();
  return replacements[normalized] ?? replacements[key] ?? match;
});

export const getEventGreeting = (event, greetingTemplates = {}) => {
  if (!event) return null;
  const type = String(event.type || '').trim() || String(event.name || '').trim();
  const configured = resolveTemplate(type, greetingTemplates);
  const baseDate = getEventDate(event);
  if (!baseDate) return null;
  const occurs = nextOccurrence(event) || baseDate;
  const years = Math.max(occurs.getFullYear() - baseDate.getFullYear(), 1);
  const isBirthday = type.toLowerCase().includes('birthday');
  const isAnniversary = type.toLowerCase().includes('anniversary');
  const name = greetingName(event);
  const eventName = String(event.type || event.name || 'Celebration').trim();
  const defaults = isBirthday
    ? `Happy {ordinal} Birthday ${name} 🎂\nWishing you a wonderful year filled with happiness, health and success.`
    : isAnniversary
      ? `Happy {ordinal} Anniversary ❤️\nWishing you many more years of happiness and beautiful memories together.`
      : `Happy {eventName} 🎉\nWishing you a wonderful celebration and beautiful memories to treasure.`;
  const template = configured || defaults;
  const text = renderTemplate(template, {
    name,
    ordinal: ordinal(years),
    age: isBirthday ? String(years) : '',
    years: isAnniversary ? String(years) : '',
    eventName,
    eventDate: formatDate(occurs),
  });
  const [title, ...body] = text.split(/\n+/).filter(Boolean);
  return {
    title: title || (isBirthday ? `Happy ${ordinal(years)} Birthday ${name} 🎂` : isAnniversary ? `Happy ${ordinal(years)} Anniversary ❤️` : `Happy ${eventName} 🎉`),
    body: body.join(' ') || 'Wishing you a wonderful celebration and beautiful memories to treasure.',
  };
};
