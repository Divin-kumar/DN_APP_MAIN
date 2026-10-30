import { ArrowDown, ArrowUp } from 'lucide-react';
import DropdownSelect from './DropdownSelect';
import './SortControl.css';

export default function SortControl({ field, direction, onFieldChange, onToggleDirection, options, label = 'Sort by', className = '', compactDirection = true }) {
  const selected = options.find((option) => option.value === field);
  const date = field === 'date', name = ['name', 'title'].includes(field), amount = field === 'amount';
  const directionLabel = direction === 'asc' ? (date ? 'Oldest first' : name ? 'A–Z' : amount ? 'Lowest first' : 'Ascending')
    : date ? 'Newest first' : name ? 'Z–A' : amount ? 'Highest first' : 'Descending';
  return <div className={`sort-control dn-user-sort${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
    <DropdownSelect aria-label={`${label} field`} value={field} onChange={(event) => onFieldChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </DropdownSelect>
    <button type="button" className="dn-sort-direction" onClick={onToggleDirection}
      aria-label={direction === 'asc' ? 'Sort descending' : 'Sort ascending'} title={`${selected?.label || 'Sort'}: ${directionLabel}`}>
      {direction === 'asc' ? <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" />}
      <span>{compactDirection ? (direction === 'asc' ? 'Asc' : 'Desc') : directionLabel}</span>
    </button>
  </div>;
}
