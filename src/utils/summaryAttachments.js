// Photos remain in their owning Moment or Activity story, never in a detached footer.
// Missing/legacy Activity references remain visible on the Moment card.
export const summaryAttachmentsFor = (moment, activityId = null) => {
  const activities = new Set((moment?.activities || []).map((activity) => String(activity?.id || '').trim()).filter(Boolean));
  const requestedId = activityId === null ? null : String(activityId).trim();
  return (moment?.attachments || []).filter((attachment) => {
    if (!attachment) return false;
    const linkedId = String(attachment.activityId || '').trim();
    if (requestedId !== null) return linkedId === requestedId;
    return !linkedId || !activities.has(linkedId);
  });
};
