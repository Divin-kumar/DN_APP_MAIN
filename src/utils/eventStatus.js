export const getEventStatus = (event = {}) => {
  if (event.archived) return 'archived';
  if (String(event.status || '').toLowerCase() === 'cancelled') return 'cancelled';
  const activities = Array.isArray(event.activities) ? event.activities : [];
  const activeActivities = activities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  return activeActivities.length > 0 && activeActivities.every((activity) => activity.completed) ? 'completed' : 'in-progress';
};

// Archive is a presentation state; preserve an explicit cancellation through
// normalization so restoring the same Moment does not silently reopen it.
export const getStoredEventStatus = (event = {}) => String(event.status || '').toLowerCase() === 'cancelled'
  ? 'cancelled' : getEventStatus(event);
