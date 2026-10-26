// Conditions are browser UI choices; no business record is modified here.
const MAX_DEPTH = 12;
const MAX_NODES = 300;
const own = (value, key) => value != null && Object.prototype.hasOwnProperty.call(value, key);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const text = (value) => String(value ?? '').trim();
const isObject = (value) => value !== null && typeof value === 'object';
const isEmpty = (value) => value == null || value === '' || (Array.isArray(value) && !value.length);
const dateText = /^\d{4}-\d{2}-\d{2}(?:$|T)/;
const valueCollator = new Intl.Collator(undefined, { numeric: true });
const sampleSignature = (value) => {
  if (isEmpty(value)) return null;
  if (typeof value === 'string') return dateText.test(value) ? 'string:date' : 'string:text';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number:finite' : 'number:invalid';
  return typeof value;
};
export const emptyGroup = () => ({ id: 'root', kind: 'group', join: 'AND', children: [] });
const labelFor = (path) => path.replaceAll('[]', '').split('.').map((part) => part
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())).join(' · ');
const dateObject = (value) => {
  if (value instanceof Date) return value;
  if (!isObject(value)) return null;
  if (typeof value.toDate === 'function') { try { return value.toDate(); } catch { return null; } }
  if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000 + (Number(value._nanoseconds) || 0) / 1e6);
  if (Number.isFinite(value.seconds) && (own(value, 'nanoseconds') || Object.keys(value).length === 1)) return new Date(value.seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6);
  return null;
};
const scalar = (value) => { const date = dateObject(value); return date ? Number.isFinite(date.getTime()) ? date.toISOString() : null : value; };
const guessType = (name, values) => {
  const present = values.filter((value) => !isEmpty(value));
  if (present.length && present.every((value) => typeof value === 'boolean')) return 'boolean';
  const leaf = name.split('.').at(-1).replace(/\[\]$/, '');
  if (/^(?:date|createdAt|updatedAt|completedAt|dueAt|timestamp|startDate|endDate)$/i.test(leaf) || /(?:Date|At)$/.test(leaf)
    || (present.length && present.every((value) => typeof value === 'string' && dateText.test(value)))) return 'date';
  if (present.length && present.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'number';
  return 'text';
};
const schemaType = (field) => field.enum || field.type === 'dropdown' || field.type === 'enum' ? 'dropdown'
  : field.format === 'date' || field.format === 'date-time' ? 'date'
    : field.type === 'integer' ? 'number' : ['text', 'number', 'date', 'boolean'].includes(field.type) ? field.type : null;
// Descriptors or JSON Schema expose fields/enumerations before records exist.
const descriptors = (schema, prefix = '', depth = 0) => {
  if (!schema || depth > MAX_DEPTH) return [];
  if (Array.isArray(schema)) return schema.filter((field) => typeof field?.path === 'string');
  return Object.entries(schema.properties || {}).flatMap(([key, definition]) => {
    if (forbidden.has(key)) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    if (definition?.type === 'object' || definition?.properties) return descriptors(definition, path, depth + 1);
    if (definition?.type === 'array' && definition.items?.properties) return descriptors(definition.items, `${path}[]`, depth + 1);
    return [{ ...(definition?.type === 'array' ? definition.items : definition), path: definition?.type === 'array' ? `${path}[]` : path }];
  });
};
export const discoverConditionFields = (records = [], schema = []) => {
  const fields = new Map();
  const ensure = (path) => {
    let field = fields.get(path);
    if (!field) { field = { path, values: new Set(), samples: [], sampleSignatures: new Set(), label: labelFor(path) }; fields.set(path, field); }
    return field;
  };
  for (const hint of descriptors(schema)) {
    if (!hint.path || hint.path.split('.').some((key) => forbidden.has(key))) continue;
    const field = ensure(hint.path); field.label = hint.label || hint.title || field.label; field.type = schemaType(hint);
    for (const value of hint.enum || hint.values || []) if (!isEmpty(value)) field.values.add(String(value));
  }
  const visit = (value, path, depth, ancestors) => {
    if (depth > MAX_DEPTH) return;
    const normalized = scalar(value);
    if (normalized !== value || !isObject(value)) {
      if (!path || typeof normalized === 'function' || typeof normalized === 'symbol' || normalized === undefined) return;
      const field = ensure(path);
      const signature = sampleSignature(normalized);
      if (signature && !field.sampleSignatures.has(signature)) { field.sampleSignatures.add(signature); field.samples.push(normalized); }
      if (!isEmpty(normalized)) field.values.add(String(normalized));
      return;
    }
    if (ancestors.has(value)) return;
    const next = new Set(ancestors).add(value);
    if (Array.isArray(value)) { for (const entry of value) visit(entry, `${path}[]`, depth + 1, next); return; }
    for (const [key, entry] of Object.entries(value)) {
      if (key.startsWith('_') || forbidden.has(key) || typeof entry === 'function') continue;
      visit(entry, path ? `${path}.${key}` : key, depth + 1, next);
    }
  };
  for (const record of Array.isArray(records) ? records : []) visit(record, '', 0, new Set());
  return [...fields.values()].map(({ samples, sampleSignatures, values, ...field }) => ({ ...field,
    type: field.type || guessType(field.path, samples), values: [...values].sort(valueCollator.compare),
  })).sort((a, b) => a.label.localeCompare(b.label));
};
export const noValueOperators = new Set(['empty', 'not_empty', 'today', 'this_week', 'this_month', 'this_year', 'is_true', 'is_false']);
export const operatorsFor = (type) => {
  const universal = [['empty', 'Is empty'], ['not_empty', 'Is not empty']];
  if (type === 'number') return [['eq', 'Equals'], ['ne', 'Does not equal'], ['gt', 'Greater than'], ['gte', 'At least'], ['lt', 'Less than'], ['lte', 'At most'], ['between', 'Between'], ...universal];
  if (type === 'date') return [['eq', 'On'], ['ne', 'Not on'], ['gt', 'After'], ['lt', 'Before'], ['between', 'Custom range'], ['today', 'Today'], ['this_week', 'This week'], ['this_month', 'This month'], ['this_year', 'This year'], ...universal];
  if (type === 'boolean') return [['is_true', 'Is true'], ['is_false', 'Is false'], ['eq', 'Is'], ['ne', 'Is not'], ...universal];
  if (type === 'dropdown') return [['eq', 'Is'], ['ne', 'Is not'], ['any_of', 'Any of'], ['none_of', 'None of'], ...universal];
  return [['contains', 'Contains'], ['not_contains', 'Does not contain'], ['eq', 'Equals'], ['ne', 'Does not equal'], ['starts', 'Starts with'], ['ends', 'Ends with'], ['any_of', 'Any of'], ['none_of', 'None of'], ...universal];
};
export const operatorsForField = (field, currentOperator) => {
  const operators = operatorsFor(field?.type);
  const legacy = field?.legacyTextComparisons && operatorsFor('text').find(([operator]) => operator === currentOperator);
  return legacy && !operators.some(([operator]) => operator === currentOperator) ? [...operators, legacy] : operators;
};
export const isActiveCondition = (rule) => Boolean(rule?.field && rule.operator && (noValueOperators.has(rule.operator)
  || (rule.operator === 'between' ? Array.isArray(rule.value) && rule.value.length === 2 && rule.value.every((value) => !isEmpty(value))
    : Array.isArray(rule.value) ? rule.value.length > 0 : text(rule.value) !== '')));
export const getConditionValue = (record, path) => {
  const read = (value, parts) => {
    if (!parts.length) return scalar(value);
    const [part, ...rest] = parts, key = part.replace(/(?:\[\])+$/, ''), arrays = (part.length - key.length) / 2;
    if (forbidden.has(key) || !own(value, key)) return undefined;
    const next = value[key];
    const descend = (entry, remaining) => {
      if (!remaining) return read(entry, rest);
      return Array.isArray(entry) ? entry.flatMap((item) => { const result = descend(item, remaining - 1); return Array.isArray(result) ? result : [result]; }) : undefined;
    };
    return descend(next, arrays);
  };
  return typeof path === 'string' ? read(record, path.split('.')) : undefined;
};
const calendarKey = (value) => {
  const normalized = scalar(value);
  if (typeof normalized === 'number' && Number.isFinite(normalized)) {
    const date = new Date(normalized);
    return Number.isFinite(date.getTime()) ? localKey(date) : null;
  }
  if (typeof normalized !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(normalized)) return null;
  const day = normalized.slice(0, 10), date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === day ? day : null;
};
const localKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const relativeRange = (operator, now) => {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate()), last = new Date(first);
  if (operator === 'this_week') { first.setDate(first.getDate() - (first.getDay() + 6) % 7); last.setTime(first.getTime()); last.setDate(last.getDate() + 6); }
  if (operator === 'this_month') { first.setDate(1); last.setMonth(last.getMonth() + 1, 0); }
  if (operator === 'this_year') { first.setMonth(0, 1); last.setMonth(11, 31); }
  return [localKey(first), localKey(last)];
};
const booleanValue = (value) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : null;
const compileRule = (rule, fields, now) => {
  if (!isActiveCondition(rule)) return null;
  const type = fields.get(rule.field)?.type;
  if (type && !operatorsForField(fields.get(rule.field), rule.operator).some(([operator]) => operator === rule.operator)) return () => false;
  const expected = text(rule.value).toLocaleLowerCase();
  const choices = new Set((Array.isArray(rule.value) ? rule.value : [rule.value]).map((entry) => text(entry).toLocaleLowerCase()));
  const range = ['today', 'this_week', 'this_month', 'this_year'].includes(rule.operator) ? relativeRange(rule.operator, now) : rule.value;
  return (record) => {
    const field = fields.get(rule.field);
    const raw = field?.readValue ? field.readValue(record, rule) : getConditionValue(record, rule.field), values = Array.isArray(raw) ? raw : [raw];
    if (rule.operator === 'empty') return values.every(isEmpty);
    if (rule.operator === 'not_empty') return values.some((value) => !isEmpty(value));
    const compare = (value) => {
      if (isEmpty(value)) return false;
      const kind = type || guessType(rule.field, [value]);
      if (kind === 'number') {
        const left = Number(value), right = Number(rule.value);
        if (!Number.isFinite(left)) return false;
        if (rule.operator === 'between') return Array.isArray(range) && range.every((entry) => text(entry) && Number.isFinite(Number(entry))) && left >= Number(range[0]) && left <= Number(range[1]);
        if (!Number.isFinite(right)) return false;
        return ({ eq: () => left === right, ne: () => left !== right, gt: () => left > right, gte: () => left >= right, lt: () => left < right, lte: () => left <= right })[rule.operator]?.() || false;
      }
      if (kind === 'date') {
        const left = calendarKey(value), right = calendarKey(rule.value);
        if (!left) return false;
        if (['between', 'today', 'this_week', 'this_month', 'this_year'].includes(rule.operator)) {
          const from = calendarKey(range?.[0]), to = calendarKey(range?.[1]); return Boolean(from && to && left >= from && left <= to);
        }
        if (!right) return false;
        return ({ eq: () => left === right, ne: () => left !== right, gt: () => left > right, lt: () => left < right })[rule.operator]?.() || false;
      }
      if (kind === 'boolean') {
        const actual = booleanValue(value), target = rule.operator === 'is_true' ? true : rule.operator === 'is_false' ? false : booleanValue(rule.value);
        return actual !== null && target !== null && (rule.operator === 'ne' ? actual !== target : actual === target);
      }
      const actual = text(value).toLocaleLowerCase();
      return ({ eq: () => actual === expected, ne: () => actual !== expected, contains: () => actual.includes(expected), not_contains: () => !actual.includes(expected), starts: () => actual.startsWith(expected), ends: () => actual.endsWith(expected), any_of: () => choices.has(actual), none_of: () => !choices.has(actual) })[rule.operator]?.() || false;
    };
    // Negative operators require all array members to differ. Missing data
    // never becomes a false boolean or passes a negative comparison.
    return ['ne', 'not_contains', 'none_of'].includes(rule.operator) ? values.length > 0 && values.every(compare) : values.some(compare);
  };
};
export const compileConditionGroup = (group, schema = [], now = new Date()) => {
  const fields = new Map(schema.map((field) => [field.path, field]));
  const compile = (node, depth = 0) => {
    if (!node || depth > MAX_DEPTH) return null;
    if (node.kind !== 'group') return compileRule(node, fields, now);
    const children = (Array.isArray(node.children) ? node.children : []).map((child) => compile(child, depth + 1)).filter(Boolean);
    if (!children.length) return null;
    return node.join === 'OR' ? (record) => children.some((match) => match(record)) : (record) => children.every((match) => match(record));
  };
  return compile(group) || (() => true);
};
export const testCondition = (record, rule, schema = []) => (compileRule(rule, new Map(schema.map((field) => [field.path, field])), new Date()) || (() => true))(record);
export const matchesConditionGroup = (record, group, schema = []) => compileConditionGroup(group, schema)(record);
// Browser storage is untrusted: bound shape, depth, IDs and values before use.
export const normalizeConditionGroup = (value) => {
  let remaining = MAX_NODES;
  const ids = new Set();
  const visit = (node, depth, position) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || remaining-- <= 0) return null;
    let id = typeof node.id === 'string' && node.id ? node.id.slice(0, 120) : position;
    if (ids.has(id)) { let suffix = 0; id = position; while (ids.has(id)) id = `${position}-${++suffix}`; }
    ids.add(id);
    if (node.kind === 'group') return { id, kind: 'group', join: node.join === 'OR' ? 'OR' : 'AND', children: (Array.isArray(node.children) ? node.children : []).map((child, index) => visit(child, depth + 1, `${position}-${index}`)).filter(Boolean) };
    if (node.kind !== 'rule' || typeof node.field !== 'string' || node.field.split('.').some((part) => forbidden.has(part))) return null;
    return { id, kind: 'rule', field: node.field.slice(0, 500), operator: typeof node.operator === 'string' ? node.operator.slice(0, 40) : '', value: Array.isArray(node.value) ? node.value.filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry)).slice(0, 1000) : ['string', 'number', 'boolean'].includes(typeof node.value) ? node.value : '' };
  };
  const root = visit(value, 0, 'root'); return root?.kind === 'group' ? root : emptyGroup();
};
export const conditionCount = (group) => !Array.isArray(group?.children) ? 0 : group.children.reduce((total, node) => total + (node?.kind === 'group' ? conditionCount(node) : isActiveCondition(node) ? 1 : 0), 0);
export const mapConditions = (node, id, transform) => node.id === id ? transform(node) : node.kind === 'group' ? { ...node, children: node.children.map((child) => mapConditions(child, id, transform)).filter(Boolean) } : node;
export const removeCondition = (node, id) => node.id === id ? null : node.kind === 'group' ? { ...node, children: node.children.map((child) => removeCondition(child, id)).filter(Boolean) } : node;
export const conditionChipEntries = (group, schema = []) => {
  const fields = new Map(schema.map((field) => [field.path, field]));
  const describe = (node) => {
    const field = fields.get(node.field);
    if (!field) return 'Unavailable filter';
    const labelValue = (value) => field.options?.find((option) => option.value === String(value))?.label
      || (field.type === 'dropdown' ? field.labelValue?.(value) || 'Unavailable choice' : text(value));
    const value = Array.isArray(node.value) ? node.value.map(labelValue).join(node.operator === 'between' ? ' – ' : ', ') : labelValue(node.value);
    const operator = operatorsForField(field, node.operator).find(([operator]) => operator === node.operator)?.[1] || 'is';
    return `${field.label} ${operator}${noValueOperators.has(node.operator) ? '' : ` ${value}`}`;
  };
  const visit = (node, logic = []) => node?.kind === 'group' ? node.children.flatMap((child) => visit(child, [...logic, node.join])) : isActiveCondition(node) ? [{ id: node.id,
    label: `${logic.includes('OR') ? `${logic.join(' › ')} · ` : ''}${describe(node)}`,
  }] : [];
  return group ? visit(group) : [];
};
export const conditionChips = (group, schema = []) => conditionChipEntries(group, schema).map((entry) => entry.label);
