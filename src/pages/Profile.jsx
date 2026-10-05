import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Activity, AlertCircle, CalendarDays, Camera, CheckCircle2, Heart, HardDrive, ImagePlus, Settings2, Smartphone, WalletCards, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import './profile.css';
import StatePanel from '../components/common/StatePanel';

const displayDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'long' }) : '—';
const initialsFor = (value) => String(value || 'DN').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'DN';

const compressProfileImage = async (file) => {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.78);
    if (result.length > 750_000) throw new Error('This image could not be reduced enough. Choose a smaller photo.');
    return result;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export default function Profile() {
  const principal = useAppStore((state) => state.principal);
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const setProfile = useAppStore((state) => state.setProfile);
  const showToast = useAppStore((state) => state.showToast);
  const events = useEventStore((state) => state.events);
  const eventsLoading = useEventStore((state) => state.loading);
  const eventsError = useEventStore((state) => state.error);
  const eventsLoadedFor = useEventStore((state) => state.loadedFor);
  const loadEvents = useEventStore((state) => state.loadEvents);
  const expenses = useExpenseStore((state) => state.expenses);
  const expensesLoading = useExpenseStore((state) => state.loading);
  const expensesError = useExpenseStore((state) => state.error);
  const expensesLoadedFor = useExpenseStore((state) => state.loadedFor);
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);
  const incomes = useIncomeStore((state) => state.incomes);
  const incomesLoading = useIncomeStore((state) => state.loading);
  const incomesError = useIncomeStore((state) => state.error);
  const incomesLoadedFor = useIncomeStore((state) => state.loadedFor);
  const loadIncomes = useIncomeStore((state) => state.loadIncomes);
  const fileInput = useRef(null);
  const [draft, setDraft] = useState(profile);
  const [storage, setStorage] = useState(null);
  const [saving, setSaving] = useState(false);
  const principalId = principal?.principalId;
  const displayName = profile.displayName || principal?.deviceName || 'Your profile';

  useEffect(() => setDraft(profile), [profile]);

  useEffect(() => {
    if (!principalId) return;
    void Promise.all([loadEvents(principalId), loadExpenses(principalId), loadIncomes(principalId)]);
  }, [principalId, loadEvents, loadExpenses, loadIncomes]);

  useEffect(() => {
    const estimate = navigator.storage?.estimate;
    if (estimate) void estimate.call(navigator.storage).then(setStorage).catch(() => setStorage(null));
  }, []);

  const activities = useMemo(() => events.flatMap((event) => event.activities || []), [events]);
  const memories = useMemo(() => events.flatMap((event) => event.memories || []), [events]);
  const completedActivityCount = activities.filter((activity) => activity.completed).length;
  const counts = {
    moments: events.length,
    activities: activities.length,
    memories: memories.length,
    expenses: expenses.length,
    income: incomes.length,
  };
  const dataError = eventsError === 'Unable to load events.'
    || expensesError === 'Unable to load expenses.'
    || incomesError === 'Unable to load incomes.';
  const dataLoading = eventsLoading || expensesLoading || incomesLoading
    || ((!eventsLoadedFor && !events.length && !eventsError) || (!expensesLoadedFor && !expenses.length && !expensesError) || (!incomesLoadedFor && !incomes.length && !incomesError));
  const noLifeData = !events.length && !expenses.length && !incomes.length;
  const earned = [
    { title: 'First Backup', earned: Boolean(readBackupStatus()?.verified) },
    { title: 'First Memory', earned: memories.length > 0 },
    { title: '100 Activities Completed', earned: completedActivityCount >= 100 },
  ];
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || 'Automatic';
  const displayFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(2026, 9, 5));
  const profileInitials = initialsFor(profile.nickname || displayName);
  const quotaLabel = storage?.quota ? `${formatStorage(storage.usage)} of ${formatStorage(storage.quota)}` : 'Unavailable';

  const saveProfile = async () => {
    setSaving(true);
    try {
      await setProfile(draft);
      showToast('Profile saved', 'success');
    } catch (error) {
      showToast(error?.message || 'Profile could not be saved', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const choosePhoto = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const photoDataUrl = await compressProfileImage(file);
      setDraft((current) => ({ ...current, photoDataUrl }));
    } catch (error) {
      showToast(error?.message || 'Photo could not be loaded', 'danger');
    }
  };

  return (
    <main className="profile-page">
      <header className="profile-page-heading">
        <Link to="/settings" className="profile-back-link"><ArrowLeft size={16} /> Settings</Link>
        <span className="profile-eyebrow">Local to this device</span>
        <h1>Profile</h1>
        <p>Your personal space in DN. No account or cloud profile is required.</p>
      </header>

      <section className="profile-hero" aria-label="Your profile">
        <div className="profile-hero-top">
          <div className="profile-avatar-wrap">
            {draft.photoDataUrl ? <img className="profile-avatar" src={draft.photoDataUrl} alt="Profile" /> : <span className="profile-avatar profile-avatar-initials" aria-label="Initials avatar">{profileInitials}</span>}
            <button type="button" className="profile-photo-button" onClick={() => fileInput.current?.click()} aria-label="Upload profile photo"><Camera size={15} /></button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void choosePhoto(event)} />
          </div>
          <div className="profile-member-since"><span>Member since</span><strong>{displayDate(principal?.createdAt)}</strong></div>
        </div>
        <div className="profile-fields">
          <label><span>Display name</span><input maxLength={80} value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder={principal?.deviceName || 'Your name'} /></label>
          <label><span>Nickname <small>Optional</small></span><input maxLength={80} value={draft.nickname} onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))} placeholder="What should DN call you?" /></label>
          <label className="profile-description-field"><span>Personal description <small>Optional</small></span><textarea maxLength={500} rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="A little about you" /></label>
        </div>
        <div className="profile-hero-actions">
          {draft.photoDataUrl ? <button type="button" className="profile-remove-photo" onClick={() => setDraft((current) => ({ ...current, photoDataUrl: '' }))}><X size={14} /> Remove photo</button> : <button type="button" className="profile-remove-photo" onClick={() => fileInput.current?.click()}><ImagePlus size={14} /> Add photo</button>}
          <button type="button" className="settings-primary-button" onClick={() => void saveProfile()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-life-summary">
        <div className="profile-section-heading"><div><span className="profile-eyebrow">Your life in DN</span><h2 id="profile-life-summary">Life Summary</h2></div></div>
        {dataError ? <StatePanel variant="error" icon={AlertCircle} title="Your life summary couldn’t be loaded" description="Your profile is still available. Try again to refresh the record counts." actionLabel="Try again" onAction={() => { void loadEvents(principalId); void loadExpenses(principalId); void loadIncomes(principalId); }} />
          : dataLoading ? <StatePanel variant="loading" icon={Activity} title="Loading your life summary" description="Gathering your saved Moments and financial records." />
            : noLifeData ? <StatePanel variant="empty" icon={Heart} title="Your summary will grow with your records" description="Moments, activities, memories, income, and expenses will appear here as you add them." />
              : <div className="profile-stat-grid">
                <Stat icon={CalendarDays} label="Moments" value={counts.moments} />
                <Stat icon={Activity} label="Activities" value={counts.activities} />
                <Stat icon={Heart} label="Memories" value={counts.memories} />
                <Stat icon={WalletCards} label="Expenses" value={counts.expenses} />
                <Stat icon={WalletCards} label="Income" value={counts.income} />
              </div>}
      </section>

      <section className="profile-section" aria-labelledby="profile-achievements">
        <div className="profile-section-heading"><div><span className="profile-eyebrow">Milestones</span><h2 id="profile-achievements">Achievements</h2></div></div>
        <div className="profile-achievement-list">{earned.map(({ title, earned: isEarned }) => <div className={`profile-achievement${isEarned ? ' is-earned' : ''}`} key={title}><span><CheckCircle2 size={17} /></span><strong>{title}</strong><small>{isEarned ? 'Earned' : 'In progress'}</small></div>)}</div>
      </section>

      <section className="profile-section" aria-labelledby="profile-device">
        <div className="profile-section-heading"><div><span className="profile-eyebrow">Private by design</span><h2 id="profile-device">Device</h2></div></div>
        <div className="profile-detail-list">
          <Detail label="Device name" value={principal?.deviceName || 'This device'} />
          <Detail label="Local Device User ID" value={principalId || 'Unavailable'} mono />
          <Detail label="Version" value={import.meta.env.VITE_APP_VERSION || 'dev'} />
          <Detail icon={HardDrive} label="Storage" value={quotaLabel} />
        </div>
        <p className="profile-storage-footnote">Browser storage estimates are approximate and can include data from other sites or apps.</p>
      </section>

      <section className="profile-section" aria-labelledby="profile-preferences">
        <div className="profile-section-heading"><div><span className="profile-eyebrow">Your setup</span><h2 id="profile-preferences">Preferences</h2></div><Link to="/settings#preferences" aria-label="Edit preferences"><Settings2 size={17} /></Link></div>
        <div className="profile-detail-list">
          <Detail label="Theme" value={preferences.theme === 'light' ? 'Light' : 'Dark'} />
          <Detail label="Amount display" value="INR (currently fixed)" />
          <Detail label="Date Format" value={displayFormat} />
          <Detail label="Locale" value={`${locale} · automatic`} />
        </div>
      </section>
    </main>
  );
}

function readBackupStatus() {
  try { return JSON.parse(localStorage.getItem('lifehub_last_backup_status') || 'null'); } catch { return null; }
}

function formatStorage(value = 0) {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) { amount /= 1024; unit = units[index]; }
  return `${amount.toFixed(1)} ${unit}`;
}

function Stat({ icon: Icon, label, value }) {
  return <div className="profile-stat"><span><Icon size={16} /></span><strong>{Number(value || 0).toLocaleString()}</strong><small>{label}</small></div>;
}

function Detail({ icon: Icon, label, value, mono = false }) {
  return <div className="profile-detail"><span>{Icon ? <Icon size={15} /> : null}{label}</span><strong className={mono ? 'is-mono' : ''}>{value}</strong></div>;
}
