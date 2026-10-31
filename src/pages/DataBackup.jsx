// A separate destination for all backup, restore and data-deletion controls.
// Reuse the existing Settings data controller, keeping restore safety and the
// offline/Firebase logic identical rather than maintaining two copies.
import Settings from './Settings';

export default function DataBackup() {
  return <Settings dataBackupOnly />;
}
