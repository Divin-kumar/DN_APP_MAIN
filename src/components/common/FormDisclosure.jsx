// Progressive disclosure keeps contextual defaults editable but out of the way.
// Native details supports keyboard interaction and screen-reader navigation.
export default function FormDisclosure({ label = 'More options', hint = '', children, className = '' }) {
  return <details className={`dn-form-disclosure ${className}`.trim()}>
    <summary><span>{label}</span>{hint ? <small>{hint}</small> : null}</summary>
    <div className="dn-form-disclosure-content">{children}</div>
  </details>;
}
