import { Moon, Palette, Sun, UserCircle } from 'lucide-react';
import useAppStore from '../store/useAppStore';

export default function Settings() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const darkMode = useAppStore((state) => state.darkMode);
  const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);
  const profileName = user?.displayName || user?.email || 'Guest';

  return (
    <div className="settings-page feature-page">
      <div className="settings-heading">
        <span className="eyebrow">Preferences</span>
        <h2>Settings</h2>
        <p>Keep LifeHub comfortable for the way you plan and remember.</p>
      </div>

      <section className="settings-section">
        <div className="settings-section-heading"><UserCircle size={18} /><div><h3>Profile</h3><p>Your current session</p></div></div>
        <div className="settings-profile-row"><strong>{profileName}</strong><span>{isGuest ? 'Guest mode' : 'Authenticated mode'}</span></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><Palette size={18} /><div><h3>Appearance</h3><p>Choose the visual tone for your workspace.</p></div></div>
        <button type="button" className="settings-choice" onClick={toggleDarkMode} aria-pressed={darkMode}>
          <span className="settings-choice-icon">{darkMode ? <Moon size={17} /> : <Sun size={17} />}</span>
          <span><strong>{darkMode ? 'Dark theme' : 'Light theme'}</strong><small>Use the theme toggle to switch instantly.</small></span>
          <span className={`settings-switch ${darkMode ? 'settings-switch-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
      </section>
    </div>
  );
}
