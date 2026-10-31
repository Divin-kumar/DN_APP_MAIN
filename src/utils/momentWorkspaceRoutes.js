const workspaceRoute = /^\/events\/([^/]+)(?:\/(story|overview|activities|transactions|timeline|memories|gallery|attachments|pdf))?\/?$/;
const activityDetailRoute = /^\/events\/[^/]+\/activities\/[^/]+\/?$/;

export const isActivityDetailRoute = (pathname) => activityDetailRoute.test(pathname || '');
export const primaryNavigationPath = (pathname) => isActivityDetailRoute(pathname) || /^\/activities\/?$/.test(pathname)
  ? '/activities' : /^\/events(?:\/|$)/.test(pathname) ? '/events'
    : /^\/financials(?:\/|$)/.test(pathname) ? '/financials/transactions'
      : pathname === '/' || /^\/dashboard\/?$/.test(pathname) ? '/dashboard' : null;

const matchWorkspaceRoute = (pathname) => typeof pathname === 'string' ? pathname.match(workspaceRoute) : null;

export const getMomentWorkspaceKey = (pathname) => {
  const match = matchWorkspaceRoute(pathname);
  if (!match) return null;
  try {
    return `/events/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch {
    return `/events/${match[1]}`;
  }
};

export const getMomentWorkspaceSection = (pathname) => {
  const section = matchWorkspaceRoute(pathname)?.[2];
  if (!section || ['overview', 'timeline', 'memories'].includes(section)) return 'story';
  return section === 'attachments' ? 'gallery' : section;
};

// Keep one mounted Moment workspace when changing its section. Different
// Moments and the rest of the app retain distinct route transition keys.
export const getRouteTransitionKey = (pathname) => getMomentWorkspaceKey(pathname) || pathname;

export const isSameMomentWorkspace = (first, second) => {
  const key = getMomentWorkspaceKey(first);
  return Boolean(key && key === getMomentWorkspaceKey(second));
};

/* CHG-234: one route-aware title for the shared app header. A record's
   content title remains in its own hero; the top bar tells you where you are.
   All legacy Moment aliases deliberately map to their current workspace tab. */
export const getShellPageTitle = (pathname, { momentTitle = '' } = {}) => {
  if (/^\/dashboard\/?$/.test(pathname) || pathname === '/') return 'Dashboard';
  if (/^\/activities\/?$/.test(pathname)) return 'Activities';
  if (/^\/events\/?$/.test(pathname)) return 'Moments';
  if (isActivityDetailRoute(pathname)) return 'Activity Detail';
  if (getMomentWorkspaceKey(pathname)) return momentTitle?.trim() || 'Moment';
  if (/^\/financials(?:\/|$)/.test(pathname)) return 'Transactions';
  if (/^\/insights\/?$/.test(pathname)) return 'Insights';
  if (/^\/settings\/data-backup\/?$/.test(pathname)) return 'Data & Backup';
  if (/^\/settings\/code-lists\/?$/.test(pathname)) return 'Code Lists';
  if (/^\/settings\/about\/?$/.test(pathname)) return 'About DN';
  if (/^\/settings\/?$/.test(pathname)) return 'Settings';
  return 'DN';
};

export const shellSettingsBackPath = (pathname) =>
  /^\/settings\/(data-backup|code-lists|about)\/?$/.test(pathname) ? '/settings' : null;
