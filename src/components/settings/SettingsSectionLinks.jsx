import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './SettingsSectionLinks.css';

export default function SettingsSectionLinks({ label, sections }) {
  const location = useLocation();
  const activeId = location.hash.slice(1);

  useEffect(() => {
    if (!sections.some(({ id }) => id === activeId)) return undefined;
    const frame = requestAnimationFrame(() => {
      const section = document.getElementById(activeId);
      section?.scrollIntoView({ block: 'start', behavior: 'instant' });
      section?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, location.key, sections]);

  return <nav className="dn-settings-section-links" aria-label={label}>
    {sections.map(({ id, label: title }) => (
      <Link key={id} to={{ search: location.search, hash: `#${id}` }}
        aria-current={activeId === id ? 'location' : undefined}>
        {title}
      </Link>
    ))}
  </nav>;
}
