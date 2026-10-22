const workspaceRoute = /^\/events\/([^/]+)(?:\/(overview|activities|timeline|memories|attachments|pdf))?\/?$/;

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

export const getMomentWorkspaceSection = (pathname) => matchWorkspaceRoute(pathname)?.[2] || 'overview';

// Keep one mounted Moment workspace when changing its section. Different
// Moments and the rest of the app retain distinct route transition keys.
export const getRouteTransitionKey = (pathname) => getMomentWorkspaceKey(pathname) || pathname;

export const isSameMomentWorkspace = (first, second) => {
  const key = getMomentWorkspaceKey(first);
  return Boolean(key && key === getMomentWorkspaceKey(second));
};
