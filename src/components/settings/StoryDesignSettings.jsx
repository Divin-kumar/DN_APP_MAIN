import { useEffect, useState } from 'react';
import { BookOpenText, RotateCcw } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import useStoryDesignDefaults from '../../hooks/useStoryDesignDefaults';
import { getActiveSampleScenario } from '../../dev/sampleData';
import {
  STORY_DESIGN_DEFAULTS, STORY_DESIGN_STYLES, normalizeStoryDesign,
  saveStoryDesign, storyDesignScope,
} from '../../utils/storyDesignPreferences';
import './StoryDesignSettings.css';

const formats = [
  { id: 'journey', label: 'Journal', help: 'Photographs and memories together' },
  { id: 'diary', label: 'Diary', help: 'Long-form writing and dated entries' },
  { id: 'chronicle', label: 'Tasks', help: 'Readable, status-led progress' },
];
const labels = { heritage: 'Heritage', editorial: 'Editorial', minimal: 'Minimal' };
const descriptions = {
  heritage: 'Warm and literary',
  editorial: 'Expressive and photographic',
  minimal: 'Quiet and precise',
};

export default function StoryDesignSettings() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const saved = useStoryDesignDefaults();
  const uid = user?.uid || null;
  const isDemo = Boolean(getActiveSampleScenario(uid));
  const scope = storyDesignScope({ uid, isGuest, sample: isDemo });
  const [draft, setDraft] = useState(() => saved);
  useEffect(() => { setDraft(saved); }, [saved, scope]);
  const changed = formats.some(({ id }) => draft[id] !== saved[id]);
  const choose = (format, style) => setDraft((current) => ({ ...current, [format]: style }));

  const save = () => {
    const state = useAppStore.getState();
    const currentUid = state.user?.uid || null;
    const session = { uid: currentUid, isGuest: state.isGuest,
      sample: Boolean(getActiveSampleScenario(currentUid)) };
    if (!scope || storyDesignScope(session) !== scope) {
      showToast('Your session changed. Reopen design settings before saving.', 'danger');
      return;
    }
    if (!changed) {
      showToast('These designs are already saved', 'success');
      return;
    }
    try {
      const result = saveStoryDesign(window.localStorage, session, draft);
      if (!result.ok) throw new Error(result.reason);
      showToast('Story and PDF designs saved', 'success');
    } catch (error) {
      showToast(error?.message || 'Design settings could not be saved', 'danger');
    }
  };

  return <section className="dn-story-design-settings" id="story-pdf-appearance"
    aria-label="Story and PDF appearance">
    <div className="dn-story-design-heading">
      <BookOpenText size={19} aria-hidden="true" />
      <div><strong>Story & PDF Appearance</strong>
        <p>Set the style for each Story type. Your records stay unchanged.</p>
      </div>
    </div>
    {isDemo && scope ? <p className="dn-story-design-hint" role="status">
      Exploring the demo? Designs you save here stay separate from your personal Guest settings and backups.
    </p> : null}
    {!scope ? <p className="dn-story-design-hint" role="status">
      Sign in or enter your own Guest workspace to save designs.
    </p> : null}
    {formats.map((format) => <fieldset className="dn-story-design-group" key={format.id}>
      <legend>{format.label} <small>{format.help}</small></legend>
      <div className="dn-story-design-choices">
        {STORY_DESIGN_STYLES.map((style) => <button type="button" key={style}
          className={'dn-story-design-choice is-' + style + (draft[format.id] === style ? ' is-selected' : '')}
          aria-pressed={draft[format.id] === style}
          aria-label={format.label + ': ' + labels[style]} disabled={!scope}
          onClick={() => choose(format.id, style)}>
          <span className="dn-story-design-mini" aria-hidden="true">
            <span className="dn-story-design-mini-eyebrow">{format.label}</span>
            <span className="dn-story-design-mini-title">Our story</span>
            <span className="dn-story-design-mini-rule" />
            <span className="dn-story-design-mini-body">A day to remember</span>
          </span>
          <span className="dn-story-design-choice-name">{labels[style]}</span>
          <span className="dn-story-design-choice-note">{descriptions[style]}</span>
        </button>)}
      </div>
    </fieldset>)}
    <div className="dn-story-design-actions">
      <span className="dn-story-design-save-status" role="status" aria-live="polite">
        {!scope ? 'Choose a Guest or signed-in workspace to edit designs.'
          : changed ? 'Unsaved changes. Save to apply.'
            : 'All designs saved.'}
      </span>
      <button type="button" className="settings-secondary-button" aria-label="Suggested defaults" disabled={!scope}
        onClick={() => setDraft(normalizeStoryDesign(STORY_DESIGN_DEFAULTS))}>
        <RotateCcw size={15} aria-hidden="true" /> Defaults
      </button>
      <button type="button" className="settings-secondary-button" disabled={!scope || !changed}
        onClick={() => setDraft(saved)}>Cancel</button>
      <button type="button" className="settings-primary-button" disabled={!scope}
        aria-label="Save designs" onClick={save}>Save</button>
    </div>
    <p className="dn-story-design-hint">
      Default styles for Story and PDF. Customize individual exports in PDF Studio.
    </p>
  </section>;
}
