// Data-driven condition filtering for Moments, Activities and Transactions.
// UI state is browser-scoped; filtering never mutates business records.
const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
const text = (value) => String(value ?? '').trim();
export const emptyGroup = () => ({ id: 'root', kind: 'group', join: 'AND', children: [] });
const primitives = (record, prefix = '', depth = 0) => {
  if (!isPlain(record) || depth > 1) return [];
  return Object.entries(record).flatMap(([key, value]) => {
    if (key.startsWith('_') || typeof value === 'function' || Array.isArray(value)) return [];
    const path = prefix ? prefix + '.' + key : key;
    if (isPlain(value) && depth < 1) return primitives(value, path, depth + 1);
    return !isPlain(value) && value !== undefined && !(value instanceof Date)
      ? [{ path, value }] : value instanceof Date ? [{ path, value: value.toISOString() }] : [];
  });
};
const labelFor = (path) => path.split('.').map((part) => part
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (c) => c.toUpperCase())).join(' · ');
const guessType = (name, values) => {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== '');
  if (nonEmpty.length && nonEmpty.every((value) => typeof value === 'boolean')) return 'boolean';
  if (nonEmpty.length && nonEmpty.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'number';
  if (/(^|\.|_)(date|createdat|updatedat|completedat|dueat|timestamp|startdate|enddate)$/i.test(name)
    || (nonEmpty.length && nonEmpty.every((value) => /^\d{4}-\d{2}-\d{2}/.test(String(value))))) return 'date';
  return 'text';
};
export const discoverConditionFields = (records = []) => {
  const fields = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    primitives(record).forEach(({ path, value }) => {
      if (!fields.has(path)) fields.set(path, []);
      if (fields.get(path).length < 40 && !fields.get(path).includes(value)) fields.get(path).push(value);
    });
  });
  return [...fields.entries()].map(([path, values]) => ({
    path, label: labelFor(path), type: guessType(path, values),
    values: values.filter((v) => v !== null && v !== '' && v !== undefined).map(String).slice(0, 30),
  })).sort((a, b) => a.label.localeCompare(b.label));
};
export const operatorsFor = (type) => {
  const universal = [['empty', 'Is empty'], ['not_empty', 'Is not empty']];
  if (type === 'number') return [['eq', 'Equals'], ['ne', 'Does not equal'], ['gt', 'Greater than'], ['gte', 'At least'], ['lt', 'Less than'], ['lte', 'At most'], ...universal];
  if (type === 'date') return [['eq', 'On'], ['ne', 'Not on'], ['gt', 'After'], ['lt', 'Before'], ...universal];
  if (type === 'boolean') return [['eq', 'Is'], ['ne', 'Is not'], ...universal];
  return [['contains', 'Contains'], ['not_contains', 'Does not contain'], ['eq', 'Equals'], ['ne', 'Does not equal'], ['starts', 'Starts with'], ['ends', 'Ends with'], ...universal];
};
export const getConditionValue = (record, path) => path.split('.').reduce((acc, key) => acc?.[key], record);
export const testCondition = (record, rule, schema = []) => {
  if (!rule?.field || !rule.operator) return true;
  const value = getConditionValue(record, rule.field);
  if (rule.operator === 'empty') return value === undefined || value === null || value === '';
  if (rule.operator === 'not_empty') return value !== undefined && value !== null && value !== '';
  const kind = schema.find((field) => field.path === rule.field)?.type || guessType(rule.field, [value]);
  const actual = kind === 'boolean' ? String(Boolean(value)) : text(value);
  const expected = text(rule.value);
  if (kind === 'number') {
    const left = Number(value); const right = Number(rule.value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(left) || !Number.isFinite(right)) return false;
    switch (rule.operator) {
      case 'eq': return left === right; case 'ne': return left !== right; case 'gt': return left > right;
      case 'gte': return left >= right; case 'lt': return left < right; case 'lte': return left <= right;
      default: return false;
    }
  }
  if (kind === 'date') {
    const left = Date.parse(actual); const right = Date.parse(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (rule.operator === 'eq') return actual.slice(0, 10) === expected.slice(0, 10);
    if (rule.operator === 'ne') return actual.slice(0, 10) !== expected.slice(0, 10);
    return rule.operator === 'gt' ? left > right : rule.operator === 'lt' ? left < right : false;
  }
  const normalized = actual.toLocaleLowerCase();
  const compare = expected.toLocaleLowerCase();
  switch (rule.operator) {
    case 'eq': return normalized === compare;
    case 'ne': return normalized !== compare;
    case 'contains': return normalized.includes(compare);
    case 'not_contains': return !normalized.includes(compare);
    case 'starts': return normalized.startsWith(compare);
    case 'ends': return normalized.endsWith(compare);
    default: return false;
  }
};
export const matchesConditionGroup = (record, group, schema = []) => {
  if (!group || !Array.isArray(group.children) || !group.children.length) return true;
  const results = group.children.map((node) => node?.kind === 'group'
    ? matchesConditionGroup(record, node, schema) : testCondition(record, node, schema));
  return group.join === 'OR' ? results.some(Boolean) : results.every(Boolean);
};
export const conditionCount = (group) => !Array.isArray(group?.children) ? 0 : group.children.reduce(
  (total, node) => total + (node.kind === 'group' ? conditionCount(node) : node.field ? 1 : 0), 0);
export const mapConditions = (node, id, transform) => {
  if (node.id === id) return transform(node);
  return node.kind === 'group'
    ? { ...node, children: node.children.map((child) => mapConditions(child, id, transform)).filter(Boolean) } : node;
};
export const removeCondition = (node, id) => node.id === id ? null
  : node.kind === 'group' ? { ...node, children: node.children.map((child) => removeCondition(child, id)).filter(Boolean) } : node;
export const conditionChips = (group, schema = []) => {
  const visit = (node) => node.kind === 'group' ? node.children.flatMap(visit) : node.field
    ? [`${schema.find((field) => field.path === node.field)?.label || labelFor(node.field)} ${operatorsFor(schema.find((field) => field.path === node.field)?.type || 'text').find(([value]) => value === node.operator)?.[1] || node.operator} ${['empty', 'not_empty'].includes(node.operator) ? '' : text(node.value)}`.trim()] : [];
  return group ? visit(group) : [];
};
