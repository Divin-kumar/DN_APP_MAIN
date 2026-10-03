export default function SortControl({ field, direction, onFieldChange, onToggleDirection, options, label = 'Sort by', className = '' }) {
  return (
    <div className={`sort-control${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === field;
        const marker = selected ? (direction === 'asc' ? '↑' : '↓') : '';
        return (
          <button
            key={option.value}
            type="button"
            className={`sort-option${selected ? ' is-selected' : ''}`}
            onClick={() => (selected ? onToggleDirection() : onFieldChange(option.value))}
            aria-pressed={selected}
            aria-label={selected ? `${option.label}, ${direction === 'asc' ? 'ascending' : 'descending'}. Click to reverse.` : `Sort by ${option.label}, ascending`}
            title={selected ? `Click to sort ${option.label.toLowerCase()} ${direction === 'asc' ? 'descending' : 'ascending'}` : `Sort by ${option.label} ascending`}
          >
            {option.label}{selected ? <span aria-hidden="true"> {marker}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
