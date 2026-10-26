import { useEffect, useRef, useState } from 'react';
import { Plus, Save, Star, Trash2, X } from 'lucide-react';
import DropdownSelect from './DropdownSelect';
import { conditionChipEntries, mapConditions, noValueOperators, operatorsFor, removeCondition } from '../../utils/conditionEngine';
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
  const label = `Value for ${field?.label || node.field || 'field'}`;
  if (noValueOperators.has(node.operator)) return <span className="dn-condition-no-value">No value needed</span>;
  if (node.operator === 'between') {
    const range = Array.isArray(node.value) ? [node.value[0] ?? '', node.value[1] ?? ''] : ['', ''];
    return <div className="dn-condition-range">{['From', 'To'].map((part, index) => <label key={part}><span>{part}</span>
      <DebouncedValue className="dn-condition-value" aria-label={`${part} ${field?.label || 'value'}`}
        type={field?.type === 'date' ? 'date' : 'number'} step={field?.type === 'number' ? 'any' : undefined} value={range[index] ?? ''}
        onChange={(value) => onChange((current) => [0, 1].map((at) => at === index ? value : Array.isArray(current) ? current[at] ?? '' : ''))} />
    </label>)}</div>;
  }
  if (['any_of', 'none_of'].includes(node.operator)) {
    const selected = Array.isArray(node.value) ? node.value : node.value ? [String(node.value)] : [];
    return <div className="dn-condition-multi">
      <DropdownSelect aria-label={label} value="" searchable allowCustom placeholder="Add a value" searchLabel="Search values"
        onChange={(event) => { if (!selected.includes(event.target.value)) onChange([...selected, event.target.value]); }}>
        {(field?.values || []).filter((value) => !selected.includes(value)).map((value) => <option key={value} value={value}>{value}</option>)}
      </DropdownSelect>
      {selected.length ? <div className="dn-condition-selected-values">{selected.map((value) => <button key={value} type="button" aria-label={`Remove value ${value}`} onClick={() => onChange(selected.filter((entry) => entry !== value))}>{value}<X size={12} /></button>)}</div> : null}
    </div>;
  }
  if (field?.type === 'boolean') return <DropdownSelect aria-label={label} value={node.value} searchable
    onChange={(event) => onChange(event.target.value)} placeholder="Choose true or false"><option value="true">True</option><option value="false">False</option></DropdownSelect>;
  if (field?.type === 'dropdown' || ['eq', 'ne'].includes(node.operator) && field?.type === 'text') return <DropdownSelect
    aria-label={label} value={node.value} searchable allowCustom placeholder="Choose or type a value" searchLabel="Search values"
    onChange={(event) => onChange(event.target.value)}>{(field?.values || []).map((value) => <option key={value} value={value}>{value}</option>)}</DropdownSelect>;
  return <DebouncedValue className="dn-condition-value" aria-label={label} placeholder="Value"
    type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'} step={field?.type === 'number' ? 'any' : undefined}
    value={node.value} onChange={onChange} />;
}
function RuleEditor({ node, schema, onEdit, onRemove }) {
  const field = schema.find((item) => item.path === node.field);
  const operators = operatorsFor(field?.type);
  return <div className="dn-condition-rule">
    <DropdownSelect aria-label="Condition field" value={node.field || ''} searchable placeholder="Choose a field" searchLabel="Search fields"
      onChange={(event) => {
        const next = schema.find((item) => item.path === event.target.value);
        onEdit({ ...node, field: next?.path || '', operator: operatorsFor(next?.type)[0][0], value: '' });
      }}>
      {node.field && !field ? <option value={node.field}>{node.field} (unavailable)</option> : null}
      {schema.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
    </DropdownSelect>
    <DropdownSelect aria-label="Condition operator" value={node.operator} searchable disabled={!node.field}
      onChange={(event) => onEdit({ ...node, operator: event.target.value, value: ['between', 'any_of', 'none_of'].includes(event.target.value) ? [] : '' })}>
      {!operators.some(([operator]) => operator === node.operator) ? <option value={node.operator}>{node.operator} (unavailable)</option> : null}
      {operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </DropdownSelect>
    <div className="dn-condition-value-slot"><ValueEditor key={`${node.field}:${node.operator}`} node={node} field={field}
      onChange={(value) => onEdit((current) => ({ ...current, value: typeof value === 'function' ? value(current.value) : value }))} /></div>
    <button type="button" className="dn-condition-icon" aria-label="Remove condition" onClick={onRemove}><X size={16} /></button>
  </div>;
}
function GroupEditor({ node, schema, update, remove, depth = 0 }) {
  const modify = (id, transform) => update((root) => mapConditions(root, id, transform));
  const addRule = () => modify(node.id, (group) => ({ ...group, children: [...group.children, blankRule()] }));
  const addGroup = () => modify(node.id, (group) => ({ ...group, children: [...group.children, { id: newId(), kind: 'group', join: 'AND', children: [blankRule()] }] }));
  return <div className={`dn-condition-group${depth ? ' is-nested' : ''}`}>
    <div className="dn-condition-group-head"><span>{depth ? 'Group' : 'Match'}</span>
      <DropdownSelect aria-label={depth ? 'Nested group logic' : 'Condition group logic'} value={node.join}
        onChange={(event) => modify(node.id, (group) => ({ ...group, join: event.target.value }))}>
        <option value="AND">All conditions (AND)</option><option value="OR">Any condition (OR)</option>
      </DropdownSelect>
      {depth ? <button type="button" className="dn-condition-icon" aria-label="Remove group" onClick={() => remove(node.id)}><Trash2 size={15} /></button> : null}
    </div>
    <div className="dn-condition-children">{node.children.map((child) => child.kind === 'group'
      ? <GroupEditor key={child.id} node={child} schema={schema} update={update} remove={remove} depth={depth + 1} />
      : <RuleEditor key={child.id} node={child} schema={schema} onEdit={(next) => modify(child.id, (current) => typeof next === 'function' ? next(current) : next)} onRemove={() => remove(child.id)} />)}</div>
    <div className="dn-condition-group-actions">
      <button type="button" onClick={addRule} disabled={!schema.length}><Plus size={14} /> Add condition</button>
      {depth < 10 ? <button type="button" onClick={addGroup} disabled={!schema.length}><Plus size={14} /> AND/OR group</button> : null}
    </div>
  </div>;
}
export function ConditionChips({ filter }) {
  const chips = conditionChipEntries(filter.state.group, filter.schema);
  return chips.length ? <div className="dn-condition-chips" aria-label="Active conditions">{chips.map((chip) =>
    <button type="button" className="dn-condition-chip" key={chip.id} aria-label={`Remove filter ${chip.label}`}
      onClick={() => filter.setGroup((group) => removeCondition(group, chip.id) || group)}><span>{chip.label}</span><X size={12} /></button>)}</div> : null;
}
function PresetRow({ preset, filter, favorite }) {
  return <div className="dn-condition-preset">
    <button type="button" className="dn-condition-preset-name" onClick={() => filter.apply(preset.id)}>{preset.label}</button>
    <button type="button" className="dn-condition-icon" aria-label={favorite ? `Unfavorite ${preset.label}` : `Favorite ${preset.label}`}
      aria-pressed={favorite} onClick={() => filter.favorite(preset.id)}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
    <button type="button" className="dn-condition-icon" aria-label={`Delete saved filter ${preset.label}`} onClick={() => filter.forget(preset.id)}><Trash2 size={15} /></button>
  </div>;
}
// Embedded in the page's existing Filters control; this component deliberately
// provides no second toggle or separate filtering surface.
export default function ConditionBuilder({ filter, resultCount, resultLabel = 'results', title = 'Filters', showChips = false }) {
  const [presetName, setPresetName] = useState('');
  const [presetTab, setPresetTab] = useState('saved');
  useEffect(() => { setPresetName(''); setPresetTab('saved'); }, [filter.scopeKey]);
  const saved = [...filter.state.saved].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const recent = [...(filter.state.history || []), ...filter.state.recent.map((id) => saved.find((item) => item.id === id)).filter(Boolean)]
    .filter((item, index, items) => items.findIndex((entry) => entry.id === item.id) === index).slice(0, 8);
  const shown = presetTab === 'favorites' ? saved.filter((item) => item.favorite) : presetTab === 'recent' ? recent : saved;
  const remove = (id) => filter.setGroup((group) => removeCondition(group, id) || group);
  return <section className="dn-conditions" aria-label={title}>
    <div className="dn-conditions-toolbar"><span className="dn-conditions-count" aria-live="polite">{typeof resultCount === 'number' ? `${resultCount} ${resultLabel} · ` : ''}{filter.activeCount ? `${filter.activeCount} active` : 'Build conditions'}</span>
      {filter.activeCount || filter.state.group.children.length ? <button type="button" className="dn-conditions-clear" onClick={filter.clear}>Clear all</button> : null}</div>
    {showChips ? <ConditionChips filter={filter} /> : null}
    {!filter.schema.length ? <p className="dn-condition-empty">Fields and values appear when records are available.</p> : null}
    <GroupEditor key={filter.editorKey} node={filter.state.group} schema={filter.schema} update={filter.setGroup} remove={remove} />
    <div className="dn-conditions-save"><label>Save these conditions<input type="text" maxLength={80} placeholder="Filter name" value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label>
      <button type="button" disabled={!presetName.trim() || !filter.activeCount} onClick={() => { filter.save(presetName); setPresetName(''); }}><Save size={14} /> Save filter</button></div>
    <div className="dn-condition-presets" aria-label="Reusable filters">
      <div className="dn-condition-preset-tabs" role="tablist" aria-label="Filter presets">{[['saved', 'Saved'], ['recent', 'Recent'], ['favorites', 'Favorites']].map(([id, label]) =>
        <button key={id} type="button" role="tab" aria-selected={presetTab === id} onClick={() => setPresetTab(id)}>{label}</button>)}</div>
      <div role="tabpanel" aria-label={`${presetTab} filters`}>{shown.length ? shown.map((preset) => <PresetRow key={preset.id} preset={preset} filter={filter}
        favorite={Boolean(saved.find((item) => item.id === preset.id)?.favorite)} />) : <p className="dn-condition-empty">{presetTab === 'recent' ? 'Recently used conditions will appear here.' : presetTab === 'favorites' ? 'Star a filter to keep it here.' : 'Save conditions to reuse them.'}</p>}</div>
    </div>
  </section>;
}
