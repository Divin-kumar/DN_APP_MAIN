export default function LoadingSkeleton({ rows = 3, variant = 'list', label = 'Loading content', announceStatus = true }) {
  return (
    <div className={`loading-skeleton loading-skeleton-${variant}`} role={announceStatus ? 'status' : undefined} aria-label={announceStatus ? label : undefined} aria-busy={announceStatus ? 'true' : undefined}>
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
