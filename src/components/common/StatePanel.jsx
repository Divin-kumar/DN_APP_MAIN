import { LoaderCircle } from 'lucide-react';

export default function StatePanel({
  variant = 'empty',
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}) {
  const isLoading = variant === 'loading';
  const StatusIcon = Icon || (isLoading ? LoaderCircle : null);
  const role = isLoading ? 'status' : variant === 'error' ? 'alert' : undefined;

  return (
    <div
      className={`dn-state-panel dn-state-panel-${variant}`}
      role={role}
      aria-live={isLoading ? 'polite' : variant === 'error' ? 'assertive' : undefined}
      aria-busy={isLoading ? 'true' : undefined}
    >
      {StatusIcon ? <span className="dn-state-panel-icon"><StatusIcon size={20} aria-hidden="true" /></span> : null}
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="dn-state-panel-action secondaryButton" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}
