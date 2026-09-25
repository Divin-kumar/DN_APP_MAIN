import { create } from 'zustand';

const useDashboardStore = create((set) => ({
  upcomingEvents: [],
  activeEvents: [],
  recentMemories: [],
  timelineHighlights: [],

  setUpcomingEvents: (items) => set({ upcomingEvents: items }),
  setActiveEvents: (items) => set({ activeEvents: items }),
  setRecentMemories: (items) => set({ recentMemories: items }),
  setTimelineHighlights: (items) => set({ timelineHighlights: items }),
}));

export default useDashboardStore;
