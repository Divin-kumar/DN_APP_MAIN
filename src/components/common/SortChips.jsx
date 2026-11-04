import { ArrowDown, ArrowUp } from 'lucide-react';
import './FilterSortSheet.css';

// One consistent direction model for live Refine drafts and saved Settings defaults.
export default function SortChips({ field, direction, options, onChange, label = 'Sort by' }) {
  const pick = (nextField) => onChange(nextField,
    nextField === field ? (direction === 'asc' ? 'desc' : 'asc') : 'asc');
  return <div className="dn-refine-sort-chips" role="group" aria-label={label}>
    {options.map((option) => {
      const selected = field === option.value;
      const ascending = direction === 'asc';
      return <button type="button" key={option.value} className={selected ? 'is-selected' : ''}
        aria-pressed={selected} aria-label={`Sort by ${option.label}${selected ? ', ' + (ascending ? 'ascending' : 'descending') : ''}`}
        onClick={() => pick(option.value)}>
        <span className="dn-sort-choice-content"><span>{option.label}</span>
        {selected ? ascending ? <ArrowUp size={14} aria-hidden="true" />
          : <ArrowDown size={14} aria-hidden="true" /> : null}</span>
      </button>;
    })}
  </div>;
}
