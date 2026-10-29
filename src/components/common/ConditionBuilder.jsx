import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import DropdownSelect from './DropdownSelect';
import ModalDialog from './ModalDialog';
import { conditionChipEntries, isActiveCondition, mapConditions, noValueOperators, operatorsFor, removeCondition } from '../../utils/conditionEngine';
import { appendFilterRule, filterEditorOperators } from '../../utils/conditionEditor';
import './ConditionBuilder.css';

const newId = () => globalThis.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random()}`;
const blankRule = () => ({ id: newId(), kind: 'rule', field: '', operator: 'contains', value: '' });
function DebouncedValue({ value, onChange, immediate = false, ...props }) {
  const [draft, setDraft] = useState(value ?? '');
  const notify = useRef(onChange); notify.current = onChange;
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    if (immediate || draft === (value ?? '')) return undefined;
    const timer = setTimeout(() => notify.current(draft), 220);
    return () => clearTimeout(timer);
  }, [draft, value, immediate]);
  return <input {...props} value={draft} onChange={(event) => { setDraft(event.target.value); if (immediate) onChange(event.target.value); }}
    onBlur={() => { if (draft !== (value ?? '')) notify.current(draft); }} />;
}
function ValueEditor({ field, node, onChange, immediate = false }) {
  const label = `Value for ${field?.label || 'filter'}`;
  const options = field?.options || (field?.values || []).map((value) => ({ value: String(value), label: String(value) }));
  const allowCustom = field?.allowCustom ?? !field?.options;
  const valueLabel = (value) => options.find((option) => String(option.value) === String(value))?.label || field?.labelValue?.(value) || (allowCustom ? String(value) : 'Unavailable choice');
  if (noValueOperators.has(node.operator)) return <span className="dn-condition-no-value" aria-label="No value needed">—</span>;
  if (node.operator === 'between') {
    const range = Array.isArray(node.value) ? [node.value[0] ?? '', node.value[1] ?? ''] : ['', ''];
    return <div className="dn-condition-range">{['From', 'To'].map((part, index) => <label key={part}><span>{part}</span>
      <DebouncedValue className="dn-condition-value" immediate={immediate} aria-label={`${part} ${field?.label || 'value'}`}
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
  return <DebouncedValue className="dn-condition-value" immediate={immediate} aria-label={label} placeholder={field?.type === 'number' ? 'Enter a number' : 'Enter text'}
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
function GroupEditor({ node, schema, update, remove, depth = 0, railRef, onRailScroll, railEdges }) {
  const modify = (id, transform) => update((root) => mapConditions(root, id, transform));
  if (!node.children.length) return null;
  return <div className={`dn-condition-group${depth ? ' is-nested' : ''}`}>
    {depth || node.join === 'OR' ? <div className="dn-condition-group-note"><span>{node.join === 'OR' ? 'Any of these filters' : 'All of these filters'}</span>
      {depth ? <button type="button" className="dn-condition-icon" aria-label="Remove filter group" onClick={() => remove(node.id)}><X size={14} /></button> : null}</div> : null}
    <div className={`dn-condition-rail${!depth && railEdges?.previous ? ' has-previous' : ''}${!depth && railEdges?.next ? ' has-next' : ''}`}>
      <div className="dn-condition-children" ref={!depth ? railRef : undefined} onScroll={!depth ? onRailScroll : undefined}
        role="region" aria-label={`${node.join === 'OR' ? 'Any of' : 'All'} filter conditions, horizontal scroll`}
        tabIndex={node.children.length > 1 ? 0 : undefined}>{node.children.map((child) => child.kind === 'group'
        ? <GroupEditor key={child.id} node={child} schema={schema} update={update} remove={remove} depth={depth + 1} />
        : <RuleEditor key={child.id} node={child} schema={schema} onEdit={(next) => modify(child.id, (current) => typeof next === 'function' ? next(current) : next)} onRemove={() => remove(child.id)} />)}</div>
    </div>
  </div>;
}
function AppliedCondition({ filter, chip, node }) {
  const field = filter.schema.find((item) => item.path === node.field);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node);
  const pan = useRef({ moved: false });
  const sourceKey = JSON.stringify([node.field, node.operator, node.value]);
  useEffect(() => setEditing(false), [sourceKey]);
  const update = (patch) => filter.setGroup((group) => mapConditions(group, node.id, (current) =>
    current.field === node.field ? { ...current, ...patch } : current));
  const legacyText = field?.legacyTextComparisons && !operatorsFor('dropdown').some(([operator]) => operator === node.operator);
  const choices = field?.options || (field?.type === 'boolean'
    ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
    : (field?.values || []).map((value) => ({ value: String(value), label: String(value) })));
  const allowCustom = field?.type !== 'boolean' && (field?.allowCustom ?? !field?.options);
  const singleChoice = field && ['dropdown', 'boolean'].includes(field.type) && !Array.isArray(node.value)
    && !noValueOperators.has(node.operator) && (!legacyText || field.hideRawValues || field.type === 'boolean');
  const panHandlers = {
    onPointerDown: (event) => { pan.current = { x: event.clientX, y: event.clientY, moved: false }; },
    onPointerMove: (event) => { if (Math.abs(event.clientX - pan.current.x) > 8 || Math.abs(event.clientY - pan.current.y) > 8) pan.current.moved = true; },
    onPointerCancel: () => { pan.current.moved = true; },
    onClickCapture: (event) => { if (pan.current.moved && event.detail) { event.preventDefault(); event.stopPropagation(); } },
    onKeyDownCapture: (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.currentTarget.getAttribute('aria-expanded') === 'true') return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.querySelector('.dn-condition-chip-label')?.scrollBy({ left: event.key === 'ArrowLeft' ? -80 : 80, behavior: 'instant' });
    },
  };
  const label = <span className="dn-condition-chip-label" title={chip.label}>{chip.label}</span>;
  return <div className="dn-condition-chip">
    {singleChoice ? <DropdownSelect className="dn-condition-chip-picker" aria-label={`Change ${field.label} filter`}
      value={node.value} triggerLabel={label} allowCustom={allowCustom} searchOnDemand {...panHandlers}
      onChange={(event) => update({ value: event.target.value })}>
      {!allowCustom && !choices.some((option) => String(option.value) === String(node.value))
        ? <option value={node.value}>{field.labelValue?.(node.value) || 'Unavailable choice'}</option> : null}
      {choices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </DropdownSelect> : <button type="button" className="dn-condition-chip-edit" aria-label={`Change ${field?.label || 'unavailable'} filter`}
      disabled={!field} aria-haspopup="dialog" aria-expanded={editing} {...panHandlers}
      onClick={() => { setDraft({ ...node }); setEditing(true); }}>{label}<ChevronDown size={14} aria-hidden="true" /></button>}
    <button type="button" className="dn-condition-chip-remove" aria-label={`Remove filter ${chip.label}`}
      onClick={() => filter.setGroup((group) => removeCondition(group, chip.id) || group)}><X size={13} aria-hidden="true" /></button>
    {editing && field ? <ModalDialog title={`Change ${field.label} filter`} className="dn-applied-filter-editor" onClose={() => setEditing(false)}>
      <form className="form-surface" onSubmit={(event) => { event.preventDefault(); if (isActiveCondition(draft)) { update({ operator: draft.operator, value: draft.value }); setEditing(false); } }}>
        <DropdownSelect aria-label={`Comparison for ${field.label}`} value={draft.operator}
          onChange={(event) => setDraft((current) => {
            const operator = event.target.value;
            const structured = ['between', 'any_of', 'none_of'].includes(operator);
            return { ...current, operator, value: noValueOperators.has(operator) ? ''
              : structured ? (Array.isArray(current.value) ? current.value : [])
                : Array.isArray(current.value) ? '' : current.value };
          })}>
          {filterEditorOperators(field, draft.operator).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </DropdownSelect>
        {!noValueOperators.has(draft.operator) ? <ValueEditor field={field} node={draft} immediate
          onChange={(value) => setDraft((current) => ({ ...current, value: typeof value === 'function' ? value(current.value) : value }))} /> : null}
        <div className="form-actions"><button type="button" className="secondaryButton" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="primaryButton" disabled={!isActiveCondition(draft)}>Apply filter</button></div>
      </form>
    </ModalDialog> : null}
  </div>;
}
export function ConditionChips({ filter }) {
  const chips = conditionChipEntries(filter.state.group, filter.schema);
  const nodes = useMemo(() => {
    const byId = new Map();
    const visit = (node) => { if (node.kind === 'group') node.children.forEach(visit); else byId.set(node.id, node); };
    visit(filter.state.group); return byId;
  }, [filter.state.group]);
  return chips.length ? <div className="dn-condition-chips" role="region" aria-label="Active filters" tabIndex={chips.length > 1 ? 0 : undefined}>{chips.map((chip) =>
    <AppliedCondition key={`${filter.editorKey}:${chip.id}`} filter={filter} chip={chip} node={nodes.get(chip.id)} />)}</div> : null;
}
// Embedded in the page's existing Filters control; this component deliberately
// provides no second toggle or separate filtering surface.
export default function ConditionBuilder({ filter, resultCount, resultLabel = 'results', title = 'Filters', showChips = false }) {
  const railRef = useRef(null);
  const previousRuleCount = useRef(filter.state.group.children.length);
  const [railEdges, setRailEdges] = useState({ previous: false, next: false });
  const updateRailEdges = useCallback(() => {
    const rail = railRef.current;
    const next = rail ? { previous: rail.scrollLeft > 2, next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2 }
      : { previous: false, next: false };
    setRailEdges((current) => current.previous === next.previous && current.next === next.next ? current : next);
  }, []);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const count = filter.state.group.children.length;
    // Reveal the new editable rule without changing the scroll position when
    // reopening a saved filter set or when editing an existing rule.
    if (rail && count > previousRuleCount.current) rail.scrollLeft = rail.scrollWidth;
    previousRuleCount.current = count;
    updateRailEdges();
  }, [filter.state.group.children.length, filter.editorKey, updateRailEdges]);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateRailEdges) : null;
    observer?.observe(rail);
    [...rail.children].forEach((child) => observer?.observe(child));
    window.addEventListener('resize', updateRailEdges);
    return () => { observer?.disconnect(); window.removeEventListener('resize', updateRailEdges); };
  }, [filter.state.group.children.length, filter.editorKey, updateRailEdges]);
  const moveRail = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(220, rail.clientWidth * .82),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const remove = (id) => filter.setGroup((group) => removeCondition(group, id) || group);
  const addRule = () => filter.setGroup((group) => appendFilterRule(group, blankRule()));
  return <section className="dn-conditions" aria-label={title}>
    {!filter.schema.length ? <p className="dn-condition-empty">Filter options will appear here when available.</p> : null}
    <GroupEditor key={filter.editorKey} node={filter.state.group} schema={filter.schema} update={filter.setGroup} remove={remove}
      railRef={railRef} onRailScroll={updateRailEdges} railEdges={railEdges} />
    <div className="dn-conditions-actions"><button type="button" className="dn-conditions-add" onClick={addRule} disabled={!filter.schema.length}><Plus size={14} /> Add filter</button>
      {filter.activeCount || filter.state.group.children.length ? <button type="button" className="dn-conditions-clear" onClick={filter.clear}>Clear all</button> : null}
      {typeof resultCount === 'number' ? <span className="dn-conditions-count" aria-live="polite">{resultCount} {resultLabel}</span> : null}
      {railEdges.previous || railEdges.next ? <div className="dn-condition-rail-nav" role="group" aria-label="Navigate filter conditions">
        <button type="button" aria-label="Previous filter conditions" disabled={!railEdges.previous} onClick={() => moveRail(-1)}><ChevronLeft size={17} /></button>
        <button type="button" aria-label="Next filter conditions" disabled={!railEdges.next} onClick={() => moveRail(1)}><ChevronRight size={17} /></button>
      </div> : null}
    </div>
    {showChips ? <ConditionChips filter={filter} /> : null}
  </section>;
}
