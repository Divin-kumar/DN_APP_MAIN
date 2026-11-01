// Backward-compatible component retained for legacy imports. Creating any
// Activity is now always independent, regardless of the Moment Story mode.
export default function ActivityEntryModeFields({ moment }) {
  return moment
    ? <p className="dn-entry-mode-help">This will create an independent Activity. Add dated updates from its detail page.</p>
    : null;
}
