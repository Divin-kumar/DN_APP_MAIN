import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { conditionChips, mapConditions, operatorsFor, removeCondition } from '../../utils/conditionEngine';
import './ConditionBuilder.css';

const newId = () => globalThis.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random()}`;
const blankRule = (field) => ({ id: newId(), kind: 'rule', field: field?.path || '', operator: operatorsFor(field?.type)[0][0], value: '' });
const choiceType = (field, value, onChange, name, valuesId) => {
  if (field?.type === 'boolean') return <select className="dn-condition-value" aria-label={name} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Choose value</option><option value="true">True</option><option value="false">False</option></select>;
  return <><input className="dn-condition-value" aria-label={name} type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'}
    placeholder="Value" value={value ?? ''} list={field?.type === 'text' && field.values.length ? valuesId : undefined}
    onChange={(event) => onChange(event.target.value)} />
    {field?.type === 'text' && field.values.length ? <datalist id={valuesId}>{field.values.map((entry) => <option key={entry} value={entry} />)}</datalist> : null}
  </>;
};

function RuleEditor({ node, schema, search, onEdit, onRemove }) {
  const field = schema.find((item) => item.path === node.field) || schema[0];
  const listed = schema.filter((item) => !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.path.toLowerCase().includes(search.toLowerCase()));
  const options = listed.some((item) => item.path === field?.path) ? listed : field ? [field, ...listed] : listed;
  const operators = operatorsFor(field?.type);
  return <div className="dn-condition-rule">
    <select aria-label="Condition field" value={node.field || ''} onChange={(event) => {
      const nextField = schema.find((item) => item.path === event.target.value);
      onEdit({ ...node, field: nextField?.path || '', operator: operatorsFor(nextField?.type)[0][0], value: '' });
    }}>
      {!node.field ? <option value="">Choose a field</option> : null}
      {options.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
    </select>
    <select aria-label="Condition operator" value={node.operator} onChange={(event) => onEdit({ ...node, operator: event.target.value })}>
      {operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {!['empty', 'not_empty'].includes(node.operator)
      ? choiceType(field, node.value, (value) => onEdit({ ...node, value }), `Value for ${field?.label || 'field'}`, `dn-condition-values-${node.id}`)
      : <span className="dn-condition-no-value">No value needed</span>}
    <button type="button" className="dn-condition-icon" aria-label="Remove condition" onClick={onRemove}><X size={16} /></button>
  </div>;
}

function GroupEditor({ node, schema, search, update, remove, depth = 0 }) {
  const modify = (id, transform) => update((root) => mapConditions(root, id, transform));
  const addRule = () => modify(node.id, (group) => ({ ...group, children: [...group.children, blankRule(schema[0])] }));
  const addGroup = () => modify(node.id, (group) => ({ ...group, children: [...group.children, { id: newId(), kind: 'group', join: 'AND', children: [] }] }));
  return <div className={`dn-condition-group${depth ? ' is-nested' : ''}`}>
    <div className="dn-condition-group-head">
      <span>{depth ? 'Nested group' : 'Match'}</span>
      <select aria-label={depth ? 'Nested group logic' : 'Condition group logic'} value={node.join}
        onChange={(event) => modify(node.id, (group) => ({ ...group, join: event.target.value }))}>
        <option value="AND">All conditions (AND)</option><option value="OR">Any condition (OR)</option>
      </select>
      {depth ? <button type="button" className="dn-condition-icon" aria-label="Remove group" onClick={() => remove(node.id)}><Trash2 size={15} /></button> : null}
    </div>
    <div className="dn-condition-children">
      {node.children.map((child) => child.kind === 'group'
        ? <GroupEditor key={child.id} node={child} schema={schema} search={search} update={update} remove={remove} depth={depth + 1} />
        : <RuleEditor key={child.id} node={child} schema={schema} search={search}
          onEdit={(next) => modify(child.id, () => next)} onRemove={() => remove(child.id)} />)}
    </div>
    <div className="dn-condition-group-actions">
      <button type="button" onClick={addRule} disabled={!schema.length}><Plus size={14} /> Condition</button>
      {depth < 2 ? <button type="button" onClick={addGroup} disabled={!schema.length}><Plus size={14} /> AND/OR group</button> : null}
    </div>
  </div>;
}

export default function ConditionBuilder({ filter, resultCount, resultLabel = 'results', title = 'Advanced filters' }) {
  const [open, setOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [presetName, setPresetName] = useState('');
  const chips = conditionChips(filter.state.group, filter.schema);
  const saved = [...filter.state.saved].sort((first, second) => Number(second.favorite) - Number(first.favorite));
  const modify = (transform) => filter.setGroup(transform);
  const remove = (id) => filter.setGroup((group) => removeCondition(group, id) || group);
  const usePreset = (id) => { filter.apply(id); setOpen(true); };
  return <section className="dn-conditions" aria-label={title}>
    <div className="dn-conditions-toolbar">
      <button type="button" className="dn-conditions-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Filter size={16} aria-hidden="true" /> Filters {filter.activeCount ? <strong>{filter.activeCount}</strong> : null}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      <span className="dn-conditions-count" aria-live="polite">{resultCount} {resultLabel}</span>
      {filter.activeCount ? <button type="button" className="dn-conditions-clear" onClick={filter.clear}>Clear all</button> : null}
    </div>
    {chips.length ? <div className="dn-condition-chips" aria-label="Active conditions">
      {chips.map((chip, index) => <span className="dn-condition-chip" key={index}>{chip}</span>)}
    </div> : null}
    {open ? <div className="dn-conditions-panel">
      <label className="dn-condition-search">Search available fields
        <input type="search" placeholder="Search fields" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} />
      </label>
      <GroupEditor node={filter.state.group} schema={filter.schema} search={fieldSearch} update={modify} remove={remove} />
      <div className="dn-conditions-save">
        <label>Save these conditions<input type="text" maxLength={50} placeholder="Filter name" value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label>
        <button type="button" disabled={!presetName.trim() || !filter.activeCount} onClick={() => { filter.save(presetName); setPresetName(''); }}><Save size={14} /> Save filter</button>
      </div>
      {saved.length ? <div className="dn-condition-presets" aria-label="Saved filters">
        <strong>Saved filters</strong>
        {saved.map((preset) => <div className="dn-condition-preset" key={preset.id}>
          <button type="button" className="dn-condition-preset-name" onClick={() => usePreset(preset.id)}>{preset.label}{filter.state.recent.includes(preset.id) ? <small>Recently used</small> : null}</button>
          <button type="button" className="dn-condition-icon" aria-label={preset.favorite ? `Unfavorite ${preset.label}` : `Favorite ${preset.label}`} aria-pressed={Boolean(preset.favorite)} onClick={() => filter.favorite(preset.id)}><Star size={16} fill={preset.favorite ? 'currentColor' : 'none'} /></button>
          <button type="button" className="dn-condition-icon" aria-label={`Delete saved filter ${preset.label}`} onClick={() => filter.forget(preset.id)}><Trash2 size={15} /></button>
        </div>)}
      </div> : null}
    </div> : null}
  </section>;
}
