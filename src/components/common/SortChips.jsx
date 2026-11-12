import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';
import './FilterSortSheet.css';

// Shared by live Refine drafts and Settings defaults. Selected-chip taps retain
// their original direction toggle; this separate action makes it discoverable.
const directionDescription = (field, direction) => {
  const descending = direction === 'desc';
  if (['date', 'dueDate', 'createdAt', 'updatedAt'].includes(field)) {
    if (field === 'dueDate') return descending ? 'Latest due first' : 'Earliest due first';
    return descending ? 'Newest first' : 'Oldest first';
  }
  if (['title', 'name'].includes(field)) return descending ? 'Z to A' : 'A to Z';
  if (field === 'amount') return descending ? 'Highest first' : 'Lowest first';
  return descending ? 'Descending' : 'Ascending';
};

export default function SortChips({ field, direction, options, onChange, label = 'Sort by' }) {
  const pick = (nextField) => onChange(nextField,
    nextField === field ? (direction === 'asc' ? 'desc' : 'asc') : 'asc');
  const description = directionDescription(field, direction);
  return <div className="dn-refine-sort-control">
    <div className="dn-refine-sort-chips" role="group" aria-label={label}>
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
    </div>
    <div className="dn-refine-sort-direction" role="group" aria-label="Sort direction">
      <span className="dn-refine-sort-direction-current"><span>Direction</span><strong>{description}</strong></span>
      <button type="button" className="dn-refine-sort-reverse"
        aria-label={`Reverse sort direction, currently ${description}`}
        onClick={() => onChange(field, direction === 'asc' ? 'desc' : 'asc')}>
        <ArrowDownUp size={15} aria-hidden="true" />Reverse order
      </button>
    </div>
  </div>;
}
