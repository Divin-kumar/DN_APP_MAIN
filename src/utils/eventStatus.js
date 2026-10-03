export const getEventStatus = (event = {}) => {
  if (String(event.status || '').toLowerCase() === 'cancelled') return 'cancelled';
  const activities = Array.isArray(event.activities) ? event.activities : [];
  return activities.length > 0 && activities.every((activity) => activity.completed) ? 'completed' : 'in-progress';
};
