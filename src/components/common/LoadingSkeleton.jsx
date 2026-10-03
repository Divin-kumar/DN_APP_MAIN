export default function LoadingSkeleton({ rows = 3, variant = 'list', label = 'Loading content' }) {
  return (
    <div className={`loading-skeleton loading-skeleton-${variant}`} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="loading-skeleton-row" key={index}>
          <span className="loading-skeleton-mark" />
          <span className="loading-skeleton-copy">
            <span className="loading-skeleton-line loading-skeleton-line-primary" />
            <span className="loading-skeleton-line loading-skeleton-line-secondary" />
          </span>
          {variant === 'financial' ? <span className="loading-skeleton-amount" /> : null}
        </div>
      ))}
      <span className="loading-skeleton-visually-hidden">{label}</span>
    </div>
  );
}
