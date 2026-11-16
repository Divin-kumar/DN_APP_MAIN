import { Minus, Plus } from 'lucide-react';

// Progressive disclosure keeps contextual defaults editable but out of the way.
// Native details supports keyboard interaction and screen-reader navigation.
export default function FormDisclosure({ label = 'More options', hint = '', children, className = '' }) {
  return <details className={`dn-form-disclosure ${className}`.trim()}
    onInvalidCapture={(event) => {
      // Hidden required fields must never trap a save behind a closed sheet.
      // Reveal the invalid field before the browser attempts to focus it.
      event.currentTarget.open = true;
    }}>
    <summary>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      <Plus size={16} className="dn-form-expand" aria-hidden="true" />
      <Minus size={16} className="dn-form-collapse" aria-hidden="true" />
    </summary>
    <div className="dn-form-disclosure-content">{children}</div>
  </details>;
}
