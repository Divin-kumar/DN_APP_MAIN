import { BookHeart, ListChecks } from 'lucide-react';
import './QuietEmptyState.css';

// Presentation-only recovery for top-level discovery lists. The caller owns
// its existing shared Refine reset; this component stores no filter state.
export default function QuietEmptyState({ kind, filtered = false, hasMoments = false, onClear }) {
  const moments = kind === 'moments';
  const Icon = moments ? BookHeart : ListChecks;
  const title = filtered
    ? (moments ? 'No matching moments' : 'No matching activities')
    : moments ? 'Your story starts with one moment'
      : hasMoments ? 'No activities yet' : 'Your activities start with a Moment';
  const description = filtered
    ? 'Try another search or adjust the filters to see your saved records.'
    : moments ? 'Use + to record a Moment whenever you are ready.'
      : hasMoments ? 'Activities you add to your Moments will appear here.'
        : 'Use + to create a Moment, then add its first Activity.';
  return (
    <section className={'dn-discovery-empty' + (moments ? ' life-journey-empty' : ' event-activity-empty')}
      role="status" aria-label={title}>
      <span className="dn-discovery-empty-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {filtered && onClear ? (
        <button type="button" className="dn-discovery-empty-reset" onClick={onClear}>
          Restore saved defaults
        </button>
      ) : null}
    </section>
  );
}
