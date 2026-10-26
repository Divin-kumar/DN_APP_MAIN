import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import DropdownSelect from './DropdownSelect';
import { conditionChipEntries, mapConditions, noValueOperators, operatorsFor, removeCondition } from '../../utils/conditionEngine';
import { appendFilterRule, filterEditorOperators } from '../../utils/conditionEditor';
import './ConditionBuilder.css';

const newId = () => globalThis.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random()}`;
const blankRule = () => ({ id: newId(), kind: 'rule', field: '', operator: 'contains', value: '' });
function DebouncedValue({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(value ?? '');
  const notify = useRef(onChange); notify.current = onChange;
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    if (draft === (value ?? '')) return undefined;
    const timer = setTimeout(() => notify.current(draft), 220);
    return () => clearTimeout(timer);
  }, [draft, value]);
  return <input {...props} value={draft} onChange={(event) => setDraft(event.target.value)}
    onBlur={() => { if (draft !== (value ?? '')) notify.current(draft); }} />;
}
function ValueEditor({ field, node, onChange }) {
  const label = `Value for ${field?.label || 'filter'}`;
  const options = field?.options || (field?.values || []).map((value) => ({ value: String(value), label: String(value) }));
  const allowCustom = field?.allowCustom ?? !field?.options;
  const valueLabel = (value) => options.find((option) => String(option.value) === String(value))?.label || field?.labelValue?.(value) || (allowCustom ? String(value) : 'Unavailable choice');
  if (noValueOperators.has(node.operator)) return <span className="dn-condition-no-value" aria-label="No value needed">—</span>;
  if (node.operator === 'between') {
    const range = Array.isArray(node.value) ? [node.value[0] ?? '', node.value[1] ?? ''] : ['', ''];
    return <div className="dn-condition-range">{['From', 'To'].map((part, index) => <label key={part}><span>{part}</span>
      <DebouncedValue className="dn-condition-value" aria-label={`${part} ${field?.label || 'value'}`}
        type={field?.type === 'date' ? 'date' : 'number'} step={field?.type === 'number' ? 'any' : undefined} value={range[index] ?? ''}
        onChange={(value) => onChange((current) => [0, 1].map((at) => at === index ? value : Array.isArray(current) ? current[at] ?? '' : ''))} />
    </label>)}</div>;
  }
  if (['any_of', 'none_of'].includes(node.operator)) {
    const selected = Array.isArray(node.value) ? node.value.map(String) : node.value ? [String(node.value)] : [];
    return <div className="dn-condition-multi">
      <DropdownSelect aria-label={label} value="" allowCustom={allowCustom} placeholder="Choose an option" searchLabel="Search options"
        onChange={(event) => { if (!selected.includes(event.target.value)) onChange([...selected, event.target.value]); }}>
        {options.filter((option) => !selected.includes(String(option.value))).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </DropdownSelect>
      {selected.length ? <div className="dn-condition-selected-values">{selected.map((value) => <button key={value} type="button" aria-label={`Remove ${valueLabel(value)}`} onClick={() => onChange(selected.filter((entry) => entry !== value))}>{valueLabel(value)}<X size={12} /></button>)}</div> : null}
    </div>;
  }
  if (field?.type === 'boolean') return <DropdownSelect aria-label={label} value={node.value}
    onChange={(event) => onChange(event.target.value)} placeholder="Choose an option">{(field.options || [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect>;
  const legacyText = field?.legacyTextComparisons && !operatorsFor('dropdown').some(([operator]) => operator === node.operator);
  if (field?.type === 'dropdown' && (!legacyText || field.hideRawValues)) return <DropdownSelect
    aria-label={label} value={node.value} allowCustom={allowCustom} placeholder={allowCustom ? 'Choose or type a value' : 'Choose an option'} searchLabel="Search options"
    onChange={(event) => onChange(event.target.value)}>
    {!allowCustom && node.value !== '' && !options.some((option) => String(option.value) === String(node.value)) ? <option value={node.value}>{valueLabel(node.value)}</option> : null}
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </DropdownSelect>;
  return <DebouncedValue className="dn-condition-value" aria-label={label} placeholder={field?.type === 'number' ? 'Enter a number' : 'Enter text'}
    type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'} step={field?.type === 'number' ? 'any' : undefined}
    value={node.value} onChange={onChange} />;
}
function RuleEditor({ node, schema, onEdit, onRemove }) {
  const field = schema.find((item) => item.path === node.field);
  const operators = filterEditorOperators(field, node.operator);
  return <div className="dn-condition-rule">
    <DropdownSelect aria-label="Filter by" value={node.field || ''} placeholder="Filter by" searchLabel="Search filters"
      onChange={(event) => {
        const next = schema.find((item) => item.path === event.target.value);
        onEdit({ ...node, field: next?.path || '', operator: filterEditorOperators(next)[0][0], value: '' });
      }}>
      {node.field && !field ? <option value={node.field}>Unavailable filter</option> : null}
      {schema.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
    </DropdownSelect>
    <DropdownSelect aria-label="Comparison" value={node.operator} disabled={!field} placeholder="Choose a comparison"
      onChange={(event) => onEdit({ ...node, operator: event.target.value, value: ['between', 'any_of', 'none_of'].includes(event.target.value) ? [] : '' })}>
      {!operators.some(([operator]) => operator === node.operator) ? <option value={node.operator}>Unavailable comparison</option> : null}
      {operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </DropdownSelect>
    <div className="dn-condition-value-slot">{field ? <ValueEditor key={`${node.field}:${node.operator}`} node={node} field={field}
      onChange={(value) => onEdit((current) => ({ ...current, value: typeof value === 'function' ? value(current.value) : value }))} />
      : node.field ? <span className="dn-condition-no-value">Choose another filter or remove this one.</span> : null}</div>
    <button type="button" className="dn-condition-icon" aria-label="Remove filter" onClick={onRemove}><X size={16} /></button>
  </div>;
}
function GroupEditor({ node, schema, update, remove, depth = 0 }) {
  const modify = (id, transform) => update((root) => mapConditions(root, id, transform));
  if (!node.children.length) return null;
  return <div className={`dn-condition-group${depth ? ' is-nested' : ''}`}>
    {depth || node.join === 'OR' ? <div className="dn-condition-group-note"><span>{node.join === 'OR' ? 'Any of these filters' : 'All of these filters'}</span>
      {depth ? <button type="button" className="dn-condition-icon" aria-label="Remove filter group" onClick={() => remove(node.id)}><X size={14} /></button> : null}</div> : null}
    <div className="dn-condition-children">{node.children.map((child) => child.kind === 'group'
      ? <GroupEditor key={child.id} node={child} schema={schema} update={update} remove={remove} depth={depth + 1} />
      : <RuleEditor key={child.id} node={child} schema={schema} onEdit={(next) => modify(child.id, (current) => typeof next === 'function' ? next(current) : next)} onRemove={() => remove(child.id)} />)}</div>
  </div>;
}
export function ConditionChips({ filter }) {
  const chips = conditionChipEntries(filter.state.group, filter.schema);
  return chips.length ? <div className="dn-condition-chips" aria-label="Active filters">{chips.map((chip) =>
    <button type="button" className="dn-condition-chip" key={chip.id} aria-label={`Remove filter ${chip.label}`}
      onClick={() => filter.setGroup((group) => removeCondition(group, chip.id) || group)}><span>{chip.label}</span><X size={12} /></button>)}</div> : null;
}
// Embedded in the page's existing Filters control; this component deliberately
// provides no second toggle or separate filtering surface.
export default function ConditionBuilder({ filter, resultCount, resultLabel = 'results', title = 'Filters', showChips = false }) {
  const remove = (id) => filter.setGroup((group) => removeCondition(group, id) || group);
  const addRule = () => filter.setGroup((group) => appendFilterRule(group, blankRule()));
  return <section className="dn-conditions" aria-label={title}>
    {showChips ? <ConditionChips filter={filter} /> : null}
    {!filter.schema.length ? <p className="dn-condition-empty">Filter options will appear here when available.</p> : null}
    <GroupEditor key={filter.editorKey} node={filter.state.group} schema={filter.schema} update={filter.setGroup} remove={remove} />
    <div className="dn-conditions-actions"><button type="button" className="dn-conditions-add" onClick={addRule} disabled={!filter.schema.length}><Plus size={14} /> Add filter</button>
      {filter.activeCount || filter.state.group.children.length ? <button type="button" className="dn-conditions-clear" onClick={filter.clear}>Clear all</button> : null}
      {typeof resultCount === 'number' ? <span className="dn-conditions-count" aria-live="polite">{resultCount} {resultLabel}</span> : null}
    </div>
  </section>;
}
