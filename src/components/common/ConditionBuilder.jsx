import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { GripVertical, Plus, X } from 'lucide-react';
import DropdownSelect from './DropdownSelect';
import ModalDialog from './ModalDialog';
import { conditionChipEntries, isActiveCondition, mapConditions, noValueOperators, operatorsFor, removeCondition, reorderSiblingConditions, shiftSiblingCondition } from '../../utils/conditionEngine';
import { appendFilterRule, filterEditorOperators } from '../../utils/conditionEditor';
import './ConditionBuilder.css';

const newId = () => globalThis.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random()}`;
const blankRule = () => ({ id: newId(), kind: 'rule', field: '', operator: 'contains', value: '' });
// The selected comparison is deliberately concise on phones; dropdown choices
// retain their full descriptive labels, and the saved operator never changes.
const conciseOperatorLabels = Object.freeze({
  eq: 'Is', ne: 'Not', contains: 'Has', not_contains: 'Excludes',
  gt: '>', gte: '≥', lt: '<', lte: '≤', between: 'Range',
  starts: 'Starts', ends: 'Ends', any_of: 'Any', none_of: 'None',
  empty: 'Blank', not_empty: 'Set', today: 'Today',
  this_week: 'Week', this_month: 'Month', this_year: 'Year',
});
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
function ConditionDragHandle({ id, setGroup, axis = 'vertical' }) {
  const gesture = useRef(null);
  const cleanup = () => {
    const state = gesture.current;
    if (!state) return;
    clearTimeout(state.timer);
    if (state.scrollFrame) cancelAnimationFrame(state.scrollFrame);
    state.source.classList.remove('is-drag-source');
    state.target?.classList.remove('is-drag-target');
    state.layer?.remove();
    gesture.current = null;
  };
  useEffect(() => cleanup, []);
  const updateTarget = (state) => {
    const hit = document.elementFromPoint(state.lastX, state.lastY)?.closest('[data-condition-id]');
    const target = hit !== state.source && hit?.parentElement === state.source.parentElement ? hit : null;
    if (state.target !== target) {
      state.target?.classList.remove('is-drag-target');
      target?.classList.add('is-drag-target');
      state.target = target;
    }
  };
  const autoScroll = () => {
    const state = gesture.current;
    if (!state?.active) return;
    state.scrollFrame = 0;
    const horizontal = axis === 'horizontal';
    const property = horizontal ? 'scrollLeft' : 'scrollTop';
    const distance = horizontal ? 'scrollWidth' : 'scrollHeight';
    const viewport = horizontal ? 'clientWidth' : 'clientHeight';
    const containers = [];
    for (let node = state.source.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/auto|scroll/.test(horizontal ? style.overflowX : style.overflowY) && node[distance] > node[viewport] + 1)
        containers.push(node);
    }
    const root = document.scrollingElement;
    if (root && !containers.includes(root) && root[distance] > root[viewport] + 1) containers.push(root);
    for (const container of containers) {
      const rect = container === root ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight } : container.getBoundingClientRect();
      const coordinate = horizontal ? state.lastX : state.lastY;
      const cross = horizontal ? state.lastY : state.lastX;
      const near = horizontal ? rect.left : rect.top;
      const far = horizontal ? rect.right : rect.bottom;
      const crossStart = horizontal ? rect.top : rect.left;
      const crossEnd = horizontal ? rect.bottom : rect.right;
      if (cross < crossStart - 8 || cross > crossEnd + 8 || coordinate < near - 8 || coordinate > far + 8) continue;
      const margin = 36;
      const delta = coordinate < near + margin ? -Math.max(2, Math.round((near + margin - coordinate) / 4))
        : coordinate > far - margin ? Math.max(2, Math.round((coordinate - far + margin) / 4)) : 0;
      if (!delta) continue;
      const before = container[property];
      container[property] += delta;
      if (Math.abs(container[property] - before) > 0.5) {
        updateTarget(state);
        state.scrollFrame = requestAnimationFrame(autoScroll);
        break;
      }
    }
  };
  const pickup = () => {
    const state = gesture.current;
    if (!state || state.active || !state.source.isConnected) return;
    const rect = state.source.getBoundingClientRect();
    const layer = document.createElement('div');
    // Body-level visual escapes clipping; the original remains the drop placeholder.
    layer.className = 'dn-condition-drag-float ' + (axis === 'horizontal' ? 'dn-condition-chips' : 'dn-conditions');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    const clone = state.source.cloneNode(true);
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    layer.appendChild(clone);
    Object.assign(layer.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px', pointerEvents: 'none', zIndex: '2147483000' });
    document.body.appendChild(layer);
    state.layer = layer;
    state.active = true;
    state.source.classList.add('is-drag-source');
  };
  const move = (event) => {
    const state = gesture.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.x, dy = event.clientY - state.y;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    if (!state.active && Math.hypot(dx, dy) > 7) pickup();
    if (!state.active) return;
    state.layer.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    updateTarget(state);
    if (!state.scrollFrame) state.scrollFrame = requestAnimationFrame(autoScroll);
  };
  const finish = (event) => {
    const state = gesture.current;
    if (!state || event.pointerId !== state.pointerId) return;
    move(event);
    const destination = state.active ? state.target?.getAttribute('data-condition-id') : null;
    const parent = state.source.parentElement;
    // Capture sibling positions before changing the real React condition order.
    const before = new Map([...parent.children].filter((item) => item.hasAttribute('data-condition-id'))
      .map((item) => [item.getAttribute('data-condition-id'), item.getBoundingClientRect()]));
    cleanup();
    if (!destination || destination === id) return;
    setGroup((group) => reorderSiblingConditions(group, id, destination));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    requestAnimationFrame(() => {
      if (!parent.isConnected) return;
      for (const item of parent.children) {
        const original = before.get(item.getAttribute('data-condition-id'));
        if (!original || typeof item.animate !== 'function') continue;
        const current = item.getBoundingClientRect();
        const dx = original.left - current.left, dy = original.top - current.top;
        if (Math.hypot(dx, dy) < 1) continue;
        item.animate([{ transform: 'translate3d(' + dx + 'px,' + dy + 'px,0)' },
          { transform: 'translate3d(0,0,0)' }],
        { duration: 210, easing: 'cubic-bezier(.22,.8,.25,1)' });
      }
    });
  };
  return <button type="button" className="dn-condition-grip"
    aria-label="Drag to reorder filter" title="Hold or drag to lift a filter. Arrow keys also reorder."
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      const source = event.currentTarget.closest('[data-condition-id]');
      if (!source) return;
      cleanup();
      gesture.current = { source, pointerId: event.pointerId, x: event.clientX,
        y: event.clientY, lastX: event.clientX, lastY: event.clientY,
        active: false, target: null, scrollFrame: 0, timer: setTimeout(pickup, 175) };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={move} onPointerUp={finish} onPointerCancel={cleanup}
    onKeyDown={(event) => {
      const back = axis === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const forward = axis === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      if (event.key !== back && event.key !== forward) return;
      event.preventDefault(); event.stopPropagation();
      setGroup((group) => shiftSiblingCondition(group, id, event.key === back ? -1 : 1));
    }}><GripVertical size={15} aria-hidden="true" /></button>;
}
function RuleEditor({ node, schema, onEdit, onRemove, setGroup, immediate = false }) {
  const field = schema.find((item) => item.path === node.field);
  const operators = filterEditorOperators(field, node.operator);
  return <div className="dn-condition-rule" data-condition-id={node.id}>
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
      {operators.map(([value, label]) => <option key={value} value={value} data-short-label={conciseOperatorLabels[value] || label}>{label}</option>)}
    </DropdownSelect>
    <div className="dn-condition-value-slot">{field ? <ValueEditor key={`${node.field}:${node.operator}`} node={node} field={field}
      immediate={immediate} onChange={(value) => onEdit((current) => ({ ...current, value: typeof value === 'function' ? value(current.value) : value }))} />
      : node.field ? <span className="dn-condition-no-value">Choose another filter or remove this one.</span> : null}</div>
    <button type="button" className="dn-condition-icon" aria-label="Remove filter" onClick={onRemove}><X size={16} /></button>
    <ConditionDragHandle id={node.id} setGroup={setGroup} />
  </div>;
}
function GroupEditor({ node, schema, update, remove, depth = 0, stackRef, immediate = false }) {
  const modify = (id, transform) => update((root) => mapConditions(root, id, transform));
  if (!node.children.length) return null;
  return <div className={`dn-condition-group${depth ? ' is-nested' : ''}`}>
    {depth || node.join === 'OR' ? <div className="dn-condition-group-note"><span>{node.join === 'OR' ? 'Any of these filters' : 'All of these filters'}</span>
      {depth ? <button type="button" className="dn-condition-icon" aria-label="Remove filter group" onClick={() => remove(node.id)}><X size={14} /></button> : null}</div> : null}
    <div className="dn-condition-stack">
      <div className="dn-condition-children" ref={!depth ? stackRef : undefined}
        role="region" aria-label={`${node.join === 'OR' ? 'Any of' : 'All'} filter conditions, vertical list`}
        tabIndex={node.children.length > 1 ? 0 : undefined}>{node.children.map((child) => child.kind === 'group'
        ? <GroupEditor key={child.id} node={child} schema={schema} update={update} remove={remove} depth={depth + 1} immediate={immediate} />
        : <RuleEditor key={child.id} node={child} schema={schema} onEdit={(next) => modify(child.id, (current) => typeof next === 'function' ? next(current) : next)} onRemove={() => remove(child.id)} setGroup={update} immediate={immediate} />)}</div>
    </div>
  </div>;
}
function AppliedCondition({ filter, chip, node, reducedMotion }) {
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
      const rail = event.currentTarget.closest('.dn-condition-chips');
      const target = rail?.scrollWidth > rail?.clientWidth ? rail : event.currentTarget.querySelector('.dn-condition-chip-label');
      target?.scrollBy({ left: event.key === 'ArrowLeft' ? -80 : 80, behavior: 'instant' });
    },
  };
  const label = <span className="dn-condition-chip-label" title={chip.label}>{chip.label}</span>;
  return <motion.div className="dn-condition-chip" data-condition-id={node.id}
    layout={reducedMotion ? false : 'position'}
    initial={reducedMotion ? false : { opacity: 0, scale: .95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: .96 }}
    transition={reducedMotion ? { duration: 0 } : { layout: { type: 'spring', stiffness: 510, damping: 41 }, opacity: { duration: .13 }, scale: { duration: .16 } }}>
    <ConditionDragHandle id={node.id} setGroup={filter.setGroup} axis="horizontal" />
    {singleChoice ? <DropdownSelect className="dn-condition-chip-picker" aria-label={`Change ${field.label} filter`}
      value={node.value} triggerLabel={label} allowCustom={allowCustom} searchOnDemand {...panHandlers}
      onChange={(event) => update({ value: event.target.value })}>
      {!allowCustom && !choices.some((option) => String(option.value) === String(node.value))
        ? <option value={node.value}>{field.labelValue?.(node.value) || 'Unavailable choice'}</option> : null}
      {choices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </DropdownSelect> : <button type="button" className="dn-condition-chip-edit" aria-label={`Change ${field?.label || 'unavailable'} filter`}
      disabled={!field} aria-haspopup="dialog" aria-expanded={editing} {...panHandlers}
      onClick={() => { setDraft({ ...node }); setEditing(true); }}>{label}</button>}
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
  </motion.div>;
}
export function ConditionChips({ filter, maxVisible, onShowMore, onShowLess }) {
  const reducedMotion = useReducedMotion();
  const railRef = useRef(null);
  const chips = conditionChipEntries(filter.state.group, filter.schema);
  const nodes = useMemo(() => {
    const byId = new Map();
    const visit = (node) => { if (node.kind === 'group') node.children.forEach(visit); else byId.set(node.id, node); };
    visit(filter.state.group); return byId;
  }, [filter.state.group]);
  const compact = Number.isInteger(maxVisible) && maxVisible > 0;
  const visible = compact ? chips.slice(0, maxVisible) : chips;
  const overflow = chips.length - visible.length;
  const expanded = !compact && Boolean(onShowLess);
  useEffect(() => {
    if (expanded && railRef.current) railRef.current.scrollLeft = railRef.current.scrollWidth;
  }, [expanded, chips.length]);
  return chips.length ? <div className="dn-condition-chips" role="region" aria-label="Active filters">
    <div ref={railRef} className="dn-condition-chip-rail" tabIndex={chips.length > 1 ? 0 : undefined}>
      <AnimatePresence initial={false}>
        {visible.map((chip) => <AppliedCondition key={`${filter.editorKey}:${chip.id}`}
          filter={filter} chip={chip} node={nodes.get(chip.id)} reducedMotion={reducedMotion} />)}
      </AnimatePresence>
    </div>
    {overflow > 0 ? <button type="button" className="dn-condition-more" aria-label={`Show ${overflow} more active filters`}
      onClick={onShowMore}>+{overflow}</button> : expanded ? <button type="button" className="dn-condition-more" aria-label="Show fewer active filters"
        onClick={onShowLess}>Less</button> : null}
  </div> : null;
}
// Embedded in the page's existing Filters control; this component deliberately
// provides no second toggle or separate filtering surface.
export default function ConditionBuilder({ filter, resultCount, resultLabel = 'results', title = 'Filters', showChips = false, immediate = false }) {
  const stackRef = useRef(null);
  const editableCount = useMemo(() => {
    const count = (node) => node.kind === 'group' ? node.children.reduce((total, child) => total + count(child), 0) : 1;
    return count(filter.state.group);
  }, [filter.state.group]);
  const previous = useRef({ key: filter.editorKey, count: editableCount });
  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (stack && previous.current.key === filter.editorKey && editableCount > previous.current.count) stack.scrollTop = stack.scrollHeight;
    previous.current = { key: filter.editorKey, count: editableCount };
  }, [editableCount, filter.editorKey]);
  const remove = (id) => filter.setGroup((group) => removeCondition(group, id) || group);
  const addRule = () => filter.setGroup((group) => appendFilterRule(group, blankRule()));
  return <section className="dn-conditions" aria-label={title}>
    {!filter.schema.length ? <p className="dn-condition-empty">Filter options will appear here when available.</p> : null}
    <GroupEditor key={filter.editorKey} node={filter.state.group} schema={filter.schema} update={filter.setGroup} remove={remove} immediate={immediate}
      stackRef={stackRef} />
    <div className="dn-conditions-actions"><button type="button" className="dn-conditions-add" onClick={addRule} disabled={!filter.schema.length}><Plus size={14} /> Add filter</button>
      {filter.activeCount || filter.state.group.children.length ? <button type="button" className="dn-conditions-clear" onClick={filter.clear}>Clear all</button> : null}
      {typeof resultCount === 'number' ? <span className="dn-conditions-count" aria-live="polite">{resultCount} {resultLabel}</span> : null}

    </div>
    {showChips ? <ConditionChips filter={filter} /> : null}
  </section>;
}
