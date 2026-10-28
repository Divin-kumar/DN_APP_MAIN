import { buildMomentStory } from './momentStory.js';
import { isAttachmentImage } from './activityDetail.js';

// Read-only card projection: story order, attachment ownership and record status
// remain owned by Phase 1. Image availability is checked by the scoped UI hook.
export const selectMomentListPreview = (moment, options = {}) => {
  const story = buildMomentStory(moment, options);
  const history = story.timeline.flatMap((month) => month.days.flatMap((day) => day.entries));
  const latest = history.at(-1) || story.upcoming[0] || story.undated.at(-1) || null;
  const photo = (attachments) => attachments?.find((item) => isAttachmentImage(item?.type)) || null;
  const cover = photo(story.keepsakes) || photo(latest?.attachments)
    || [...history, ...story.upcoming, ...story.undated].reverse()
      .map((entry) => photo(entry.attachments)).find(Boolean) || null;
  return { latest, upcoming: story.upcoming[0] || null, cover, status: story.status };
};
