import DropdownSelect from './DropdownSelect';
import { REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';

export default function RepeatField({ value, onChange, disabled, className, children, allowOneTime = true }) {
  return <div className={className}>
    <span>Repeat</span>
    <DropdownSelect aria-label="Repeat" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {allowOneTime ? <option value="">Doesn’t repeat</option> : null}
      {Object.entries(REPEAT_OPTIONS).map(([frequency, label]) => <option key={frequency} value={frequency}>{label}</option>)}
    </DropdownSelect>
    {value ? <small>{children}</small> : null}
  </div>;
}
