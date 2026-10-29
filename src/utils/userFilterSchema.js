import { activityTime } from './activityTime.js';
import { activityStatus } from './activityDetail.js';
import { getActivityMomentType } from './activityRecords.js';
import { getEventStatus } from './eventStatus.js';
import { recordId } from './recordIdentity.js';
import { getActiveCodeListMeta, getCodeListMeta } from './codeLists.js';
import { normalizePaymentMethod } from './paymentMethod.js';

const labels = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled', archived: 'Archived',
  income: 'Income', expense: 'Expense', high: 'High', medium: 'Medium', low: 'Low', true: 'Archived', false: 'Active' };
const readable = (value) => labels[String(value)] || String(value ?? '');
const domainFor = (scope) => scope === 'moments' ? 'moments' : scope === 'activities' ? 'activities'
  : scope.startsWith('moment-activities:') ? 'momentActivities' : scope === 'transactions' ? 'transactions'
    : scope.startsWith('moment-transactions:') ? 'momentTransactions' : null;
const at = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);

// Old archive conditions used boolean-only operators. The product selector now
// offers Active/Archived choices; adapt bounded UI groups without record writes.
export const normalizeUserFilterGroup = (scope, group) => {
  if (!['moments', 'activities'].includes(domainFor(scope))) return group;
  const visit = (node) => {
    if (node?.kind === 'group' && Array.isArray(node.children)) {
      const children = node.children.map(visit);
      return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node;
    }
    if (node?.kind !== 'rule' || node.field !== 'archived' || !['is_true', 'is_false'].includes(node.operator)) return node;
    return { ...node, operator: 'eq', value: node.operator === 'is_true' ? 'true' : 'false' };
  };
  return visit(group);
};

// Product fields combine active scoped Code Lists with recorded historical
// values. Derived/link choices stay record-driven; linked IDs remain internal.
export const getUserFilterFields = (scope, records = [], moments = [], adminValues = null) => {
  const domain = domainFor(scope);
  if (!domain) return null;
  const definitions = [];
  const add = (path, label, type, readValue = (record) => at(record, path), labelValue = readable, codeListKeys = []) => {
    definitions.push({ path, label, type, readValue, labelValue, allowCustom: type !== 'dropdown',
      codeListKeys, allowEmpty: path === 'paymentMethod', legacyTextComparisons: type === 'dropdown' && path !== 'archived', hideRawValues: ['momentId', 'eventId', 'activityId'].includes(path) });
  };
  const momentMap = new Map(moments.map((moment) => [recordId(moment.id || moment.firestoreId), moment]));
  const momentNames = new Map();
  const parentActivityNames = new Map();
  for (const [id, moment] of momentMap) {
    if (moment.name) momentNames.set(id, moment.name);
    for (const activity of moment.activities || []) {
      const key = JSON.stringify([id, recordId(activity.id)]);
      if (!parentActivityNames.has(key) && activity.title) parentActivityNames.set(key, activity.title);
    }
  }
  const activityKey = (record) => recordId(record.activityId) ? JSON.stringify([recordId(record.eventId), recordId(record.activityId)]) : '';
  const activityNames = new Map();
  const legacyActivityNames = new Map();
  for (const record of records) {
    const parentId = recordId(domain === 'activities' ? record.momentId : record.eventId);
    if (parentId && !momentNames.has(parentId)) momentNames.set(parentId,
      (domain === 'activities' ? record.momentName : record.eventTitle) || 'Unavailable Moment');
    const key = activityKey(record);
    if (key) {
      const label = parentActivityNames.get(key) || record.activityTitle || 'Unavailable Activity';
      if (!activityNames.has(key)) activityNames.set(key, label);
      if (!legacyActivityNames.has(recordId(record.activityId))) legacyActivityNames.set(recordId(record.activityId), label);
    }
  }
  if (domain === 'moments') {
    add('name', 'Moment name', 'text');
    add('type', 'Moment type', 'dropdown', (record, rule) => {
      // A saved generic Other selection continues to cover custom Other types.
      const values = Array.isArray(rule?.value) ? rule.value : [rule?.value];
      if (['contains', 'not_contains', 'starts', 'ends'].includes(rule?.operator)) return record.type || 'Personal';
      return record.type === 'Other' && values.includes('Other') ? 'Other' : getActivityMomentType(record);
    }, readable, ['eventTypes']);
    add('date', 'Event date', 'date');
    add('time', 'Time', 'dropdown', (record) => activityTime(record));
    add('status', 'Status', 'dropdown', getEventStatus);
    add('archived', 'Visibility', 'dropdown', (record) => Boolean(record.archived));
  } else if (domain === 'activities' || domain === 'momentActivities') {
    const prefix = domain === 'activities' ? 'activity.' : '';
    const activity = (record) => domain === 'activities' ? record.activity : record;
    add(`${prefix}title`, 'Activity name', 'text');
    add(`${prefix}date`, 'Date', 'date');
    add(`${prefix}time`, 'Time', 'dropdown', (record) => activityTime(activity(record)));
    add(`${prefix}status`, 'Status', 'dropdown', (record) => activityStatus(activity(record)));
    add(`${prefix}priority`, 'Priority', 'dropdown', (record) => activity(record)?.priority || 'medium', readable, ['activityPriorities']);
    if (domain === 'activities') {
      add('momentId', 'Moment', 'dropdown', (record) => record.momentId, (value) =>
        momentNames.get(String(value)) || 'Unavailable Moment');
      add('momentType', 'Moment type', 'dropdown', undefined, readable, ['eventTypes']);
      add('archived', 'Moment visibility', 'dropdown', (record) => Boolean(record.archived));
    }
  } else {
    add('name', 'Title', 'text', (record) => record.name || record.title || '');
    add('transactionKind', 'Type', 'dropdown');
    add('category', 'Category', 'dropdown', (record) => record.transactionKind === 'income' ? record.type || record.category || '' : record.category || '', readable, ['incomeTypes', 'expenseCategories']);
    add('paymentMethod', 'Payment method', 'dropdown', (record) => normalizePaymentMethod(record.paymentMethod), readable, ['paymentMethods']);
    add('amount', 'Amount', 'number');
    add('date', 'Date', 'date');
    add('time', 'Time', 'dropdown', (record) => activityTime(record));
    if (domain === 'transactions') add('eventId', 'Moment', 'dropdown', (record) => recordId(record.eventId), (value) =>
      momentNames.get(String(value)) || 'Unavailable Moment');
    add('activityId', 'Activity', 'dropdown', (record, rule) => {
      const values = Array.isArray(rule?.value) ? rule.value : [rule?.value];
      // Preserve earlier saved child-ID rules; new choices identify both owners.
      const compositeValues = values.filter((value) => typeof value === 'string' && value.startsWith('['));
      if (['any_of', 'none_of'].includes(rule?.operator) && compositeValues.length && compositeValues.length < values.length) {
        return [recordId(record.activityId), activityKey(record)];
      }
      return rule && values.every((value) => typeof value !== 'string' || !value.startsWith('[')) ? recordId(record.activityId) : activityKey(record);
    }, (value) => activityNames.get(String(value)) || legacyActivityNames.get(String(value)) || 'Unavailable Activity');
  }
  return definitions.map((field) => {
    const configured = adminValues ? field.codeListKeys.flatMap((key) => getActiveCodeListMeta(key, adminValues[key])) : [];
    const configuredLabels = new Map((adminValues ? field.codeListKeys.flatMap((key) => getCodeListMeta(key, adminValues[key])) : [])
      .map((entry) => [entry.value, entry.label]));
    const labelValue = (value) => configuredLabels.get(String(value)) || field.labelValue(value);
    const values = [...new Set([...configured.map((entry) => entry.value), ...records.map((record) => field.readValue(record))]
      .filter((value) => value !== undefined && value !== null && value !== '').map(String))];
    const options = values.map((value) => ({ value, label: labelValue(value) }))
      .sort((first, second) => first.label.localeCompare(second.label, undefined, { numeric: true }));
    return { ...field, labelValue, options, values: options.map((option) => option.value) };
  });
};
