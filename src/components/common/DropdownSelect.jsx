// This is a reusable dropdown component used for event types, categories, filters, and small forms.
// It gives the app a consistent way to render select fields with keyboard support and accessible labels.
import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const getOptionLabel = (children) => Children.toArray(children)
  .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
  .join('');

export default function DropdownSelect({
  id,
  name,
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  placeholder = 'Select an option',
  className = '',
  ...accessibilityProps
}) {
  const generatedId = useId();
  const triggerId = id || `dropdown-${generatedId}`;
  const listboxId = `${triggerId}-options`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const options = Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: String(child.props.value ?? getOptionLabel(child.props.children)),
      label: getOptionLabel(child.props.children),
      disabled: Boolean(child.props.disabled),
    }));
  const selectedIndex = options.findIndex((option) => option.value === String(value ?? ''));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  const commitOption = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== String(value ?? '')) {
      onChange?.({ target: { name, value: option.value } });
    }
    setOpen(false);
  };

  const moveActive = (direction) => {
    const enabledIndices = options.map((option, index) => (!option.disabled ? index : -1)).filter((index) => index >= 0);
    if (!enabledIndices.length) return;
    const currentPosition = enabledIndices.indexOf(activeIndex);
    const nextPosition = currentPosition < 0
      ? (direction > 0 ? 0 : enabledIndices.length - 1)
      : (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
    setActiveIndex(enabledIndices[nextPosition]);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const enabledIndices = options.map((option, index) => (!option.disabled ? index : -1)).filter((index) => index >= 0);
      if (enabledIndices.length) setActiveIndex(event.key === 'Home' ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]);
      setOpen(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) commitOption(activeIndex);
      else {
        setOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  };

  return (
    <span ref={rootRef} className={`dropdown-field${className ? ` ${className}` : ''}`}>
      <button
        id={triggerId}
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }}
        onKeyDown={handleKeyDown}
        {...accessibilityProps}
      >
        <span className={selectedOption ? '' : 'dropdown-placeholder'}>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <span id={listboxId} className="dropdown-menu" role="listbox" aria-labelledby={triggerId}>
          {options.map((option, index) => (
            <span
              id={`${listboxId}-option-${index}`}
              key={`${option.value}-${index}`}
              className={`dropdown-option${index === selectedIndex ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                commitOption(index);
              }}
            >
              <span>{option.label}</span>
              {index === selectedIndex ? <Check size={15} aria-hidden="true" /> : null}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
