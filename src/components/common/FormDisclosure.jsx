// Progressive disclosure keeps contextual defaults editable but out of the way.
// Native details supports keyboard interaction and screen-reader navigation.
export default function FormDisclosure({ label = 'More options', hint = '', children, className = '', icon: Icon }) {
  return <details className={`dn-form-disclosure ${className}`.trim()}
    onInvalidCapture={(event) => {
      // Hidden required fields must never trap a save behind a closed sheet.
      // Reveal the invalid field before the browser attempts to focus it.
      event.currentTarget.open = true;
    }}>
    <summary><span>{Icon ? <Icon size={17} aria-hidden="true" /> : null}{label}</span>{hint ? <small>{hint}</small> : null}</summary>
    <div className="dn-form-disclosure-content">{children}</div>
  </details>;
}
