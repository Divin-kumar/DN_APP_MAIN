import { buildMomentStory } from './momentStory.js';
import { projectPdfContent } from './pdfContentSelection.js';

// Filter before chapters and cover selection; source records and originals stay intact.
export const buildMomentPdfStory = (moment = {}, context = {}, selection = {}) =>
  buildMomentStory(projectPdfContent(moment, selection), context);
