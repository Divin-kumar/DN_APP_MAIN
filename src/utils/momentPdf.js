import useAppStore from '../store/useAppStore';
import { getActiveSampleScenario } from '../dev/sampleData';
import { attachmentRepository } from '../services/attachmentService';
import { activityDateLabel, activityStatusLabel, isAttachmentImage, legacyAttachmentImage } from './activityDetail';
import { getEventStatus } from './eventStatus';
import { plainRichText } from './richText';
import { summaryAttachmentsFor, sortedSummaryActivities } from './summaryAttachments';
import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH, pdfFromJpegPages, momentPdfFilename } from './pdfDocument';
import { downloadBlob } from './download';
import { buildMomentStory, groupMomentStoryTasks } from './momentStory';
import { normalizePdfStudioOptions, pdfStudioTaskSections, PDF_TEMPLATE_NAMES } from './pdfStudioOptions';
import { pdfStoryText } from './pdfStoryText';

const SCALE = 1.65;
const INSET = 43;
const CONTENT_WIDTH = PDF_PAGE_WIDTH - INSET * 2;
const BOTTOM = PDF_PAGE_HEIGHT - 51;
const palette = { ink: '#28313f', muted: '#64748b', accent: '#266a65', line: '#e0e6e9', surface: '#f1f7f5' };
const statusLabel = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled', archived: 'Archived' };
const makeCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PDF_PAGE_WIDTH * SCALE);
  canvas.height = Math.round(PDF_PAGE_HEIGHT * SCALE);
  return canvas;
};
const jpegBytes = async (canvas) => {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .84));
  if (!blob) throw new Error('The PDF page could not be rendered.');
  return { width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer()) };
};
const imageFromBlob = async (blob) => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
};

export class MomentPdfPainter {
  constructor(assertCurrent = () => {}, options = {}) {
    this.assertCurrent = assertCurrent;
    this.pages = [];
    this.pageNumber = 0;
    this.template = options.template || 'legacy';
    this.density = options.density || 'balanced';
    this.begin();
  }
  begin() {
    if (this.pageNumber >= 300) throw new Error('This summary is too long to export safely in one PDF.');
    this.pageNumber += 1;
    this.canvas = makeCanvas();
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('PDF rendering is unavailable in this browser.');
    this.ctx.scale(SCALE, SCALE);
    this.ctx.fillStyle = this.template === 'journey' ? '#fffcf6'
      : this.template === 'diary' ? '#fffefa' : '#fff';
    this.ctx.fillRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
    this.ctx.textBaseline = 'top';
    this.y = INSET;
    this.ctx.fillStyle = palette.accent;
    this.ctx.font = '700 10px system-ui, sans-serif';
    this.ctx.fillText('DN  /  ' + (PDF_TEMPLATE_NAMES[this.template] || 'Moment summary').toUpperCase(), INSET, 23);
  }
  async finishPage() {
    if (!this.canvas) return;
    this.assertCurrent();
    const ctx = this.ctx;
    ctx.fillStyle = palette.line;
    ctx.fillRect(INSET, PDF_PAGE_HEIGHT - 37, CONTENT_WIDTH, .7);
    ctx.fillStyle = palette.muted;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Created with DN', INSET, PDF_PAGE_HEIGHT - 28);
    const num = String(this.pageNumber);
    ctx.fillText(num, PDF_PAGE_WIDTH - INSET - ctx.measureText(num).width, PDF_PAGE_HEIGHT - 28);
    this.pages.push(await jpegBytes(this.canvas));
    this.assertCurrent();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
  async ensure(height) {
    if (this.y + height <= BOTTOM) return;
    await this.finishPage();
    this.begin();
  }
  font(size, bold) {
    const family = this.template === 'chronicle' ? 'system-ui, sans-serif' : 'Georgia, serif';
    this.ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
  }
  wrap(text, maxWidth) {
    // All stored content is treated as literal user text: nothing is parsed as HTML.
    const words = String(text).split(/(\s+)/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      if (!line && !word.trim()) continue;
      const next = line + word;
      if (this.ctx.measureText(next).width <= maxWidth) { line = next; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      if (this.ctx.measureText(word).width <= maxWidth) { line = word.trimStart(); continue; }
      // Preserve long unbroken URLs/words without writing beyond the page edge.
      for (const character of Array.from(word)) {
        if (line && this.ctx.measureText(line + character).width > maxWidth) {
          lines.push(line); line = '';
        }
        line += character;
      }
    }
    lines.push(line.trimEnd());
    return lines;
  }
  async text(value, { size = 11, bold = false, color = palette.ink, indent = 0, leading = 1.48, after = 5 } = {}) {
    this.font(size, bold);
    const rows = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    const height = size * leading * (this.density === 'airy' ? 1.17 : this.density === 'compact' ? .91 : 1);
    for (const row of rows) {
      this.font(size, bold);
      const chunks = this.wrap(row, CONTENT_WIDTH - indent);
      for (const line of chunks) {
        await this.ensure(height);
        this.font(size, bold);
        this.ctx.fillStyle = color;
        this.ctx.fillText(line, INSET + indent, this.y);
        this.y += height;
      }
    }
    this.y += after * (this.density === 'airy' ? 1.2 : this.density === 'compact' ? .74 : 1);
  }
  async heading(title, { keepWithNext = 0 } = {}) {
    // Avoid orphaned dates/section titles. A leading photograph or paragraph
    // must have space *on this page*, not on the next one.
    await this.ensure(52 + keepWithNext);
    this.y += 17;
    this.ctx.fillStyle = palette.line;
    this.ctx.fillRect(INSET, this.y, CONTENT_WIDTH, 1);
    this.y += 15;
    await this.text(title, { size: 15, bold: true, color: palette.accent, after: 10 });
  }
  async photo(attachment, context, { large = false, fitToRemaining = false, reserveAfter = 0 } = {}) {
    if (!isAttachmentImage(attachment.type)) {
      await this.text(`Other file: ${attachment.name || 'Attachment'}`, { size: 10, color: palette.muted });
      return;
    }
    let bitmap;
    try {
      this.assertCurrent();
      let blob;
      if (attachment.assetId) {
        blob = await attachmentRepository.read(attachment, context);
      } else {
        const url = legacyAttachmentImage(attachment);
        if (!url) throw new Error('Original unavailable');
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error('Original unavailable');
        blob = await response.blob();
      }
      this.assertCurrent();
      bitmap = await imageFromBlob(blob);
      this.assertCurrent();
      const naturalWidth = bitmap.width || bitmap.naturalWidth;
      const naturalHeight = bitmap.height || bitmap.naturalHeight;
      if (!naturalWidth || !naturalHeight) throw new Error('Invalid image');
      // Preserve original aspect ratio. Studio spreads shrink to the actual
      // available space, leaving space for their caption on the same page.
      // Standard legacy summaries preserve their previous pagination.
      const desiredHeight = Math.min(large ? 620 : 420, CONTENT_WIDTH * naturalHeight / naturalWidth);
      if (fitToRemaining) {
        const remaining = () => BOTTOM - this.y - reserveAfter - 13;
        // A photo should not be rendered as a postage stamp at the page foot.
        if (remaining() < Math.min(desiredHeight, 135)) {
          await this.finishPage();
          this.begin();
        }
        const height = Math.min(desiredHeight, Math.max(0, remaining()));
        const width = height * naturalWidth / naturalHeight;
        this.ctx.drawImage(bitmap, INSET + (CONTENT_WIDTH - width) / 2, this.y, width, height);
        this.y += height + 13;
        return { page: this.pageNumber, width, height };
      }
      const width = Math.min(CONTENT_WIDTH, naturalWidth / naturalHeight * (large ? 620 : 420));
      const height = Math.min(large ? 620 : 420, width * naturalHeight / naturalWidth);
      await this.ensure(height + 13);
      this.ctx.drawImage(bitmap, INSET + (CONTENT_WIDTH - width) / 2, this.y, width, height);
      this.y += height + 13;
      return { page: this.pageNumber, width, height };
    } catch (error) {
      if (String(error?.message).includes('session changed')) throw error;
      await this.text('Photo preview unavailable on this device.', { size: 10, color: palette.muted });
    } finally { bitmap?.close?.(); }
  }
  async attachments(attachments, context, options = {}) {
    const positions = [];
    for (const attachment of attachments) positions.push(await this.photo(attachment, context, options));
    return positions;
  }
  async renderedPages() {
    await this.finishPage();
    const pages = this.pages;
    this.pages = [];
    return { blob: pdfFromJpegPages(pages), pages };
  }
  async done() {
    return (await this.renderedPages()).blob;
  }
}

// Exact current Account/Guest/Sample scope is checked before and after each
// asynchronous original read. Export only the Moment supplied by the scoped UI.
export async function downloadMomentPdf(event, { greeting = event?.greetingCard, status, date } = {}) {
  if (!event) throw new Error('This Moment is no longer available.');
  const state = useAppStore.getState();
  const uid = state.user?.uid || null;
  const isGuest = Boolean(state.isGuest);
  const sample = getActiveSampleScenario(uid);
  if (!uid && !isGuest) throw new Error('Sign in or continue as Guest before downloading.');
  const assertCurrent = () => {
    const current = useAppStore.getState();
    if ((current.user?.uid || null) !== uid || Boolean(current.isGuest) !== isGuest
      || getActiveSampleScenario(uid) !== sample) throw new Error('Your session changed. Reopen the summary before downloading.');
  };
  const context = { uid, isGuest, sample: Boolean(sample), assertCurrent };
  const pdf = new MomentPdfPainter(assertCurrent);
  await pdf.text(event.name || 'Untitled moment', { size: 24, bold: true, color: palette.accent, after: 13 });
  await pdf.text(`${event.type || 'Moment'}   |   ${date || activityDateLabel(event.date)}   |   ${status || statusLabel[getEventStatus(event)] || 'Upcoming'}`,
    { size: 11, color: palette.muted, after: 18 });
  if (greeting?.title || greeting?.body) {
    await pdf.heading('Greeting');
    if (greeting.title) await pdf.text(plainRichText(greeting.title), { size: 15, bold: true });
    if (greeting.body) await pdf.text(plainRichText(greeting.body));
  }
  if (event.notes) {
    await pdf.heading('Moment notes');
    await pdf.text(plainRichText(event.notes));
  }
  await pdf.attachments(summaryAttachmentsFor(event), context);
  const activities = sortedSummaryActivities(event.activities);
  await pdf.heading(`Activities (${activities.length})`);
  for (const activity of activities) {
    await pdf.ensure(55);
    await pdf.text(activity.title || activity.name || 'Untitled activity', { size: 13, bold: true, after: 2 });
    await pdf.text(`${activityDateLabel(activity.date)}  |  ${activityStatusLabel(activity)}`, { size: 10, color: palette.muted, after: 7 });
    if (activity.description) await pdf.text(plainRichText(activity.description), { indent: 10, after: 11 });
    if (activity.id !== undefined && activity.id !== null && String(activity.id).trim()) {
      await pdf.attachments(summaryAttachmentsFor(event, activity.id), context);
    }
    pdf.y += 7;
  }
  if (event.memories?.length) {
    await pdf.heading('Memories');
    for (const memory of event.memories) {
      if (memory.title) await pdf.text(memory.title, { size: 13, bold: true, after: 2 });
      if (memory.createdAt) await pdf.text(activityDateLabel(memory.createdAt, ''), { size: 10, color: palette.muted, after: 5 });
      if (memory.body) await pdf.text(plainRichText(memory.body), { after: 13 });
    }
  }
  assertCurrent();
  const blob = await pdf.done();
  assertCurrent();
  downloadBlob(blob, momentPdfFilename(event.name));
  return blob;
}

const studioDate = (value) => activityDateLabel(value, 'Undated');
const studioText = (value) => pdfStoryText(value || '');

// Every preview image uses the exact JPEG page bytes embedded into its PDF.
// The scoped context and originals reader enforce existing Account/Guest guards.
export async function renderMomentStudioPdf(event, studioOptions = {}, { momentTypes } = {}) {
  if (!event) throw new Error('This Moment is no longer available.');
  const initial = useAppStore.getState();
  const uid = initial.user?.uid || null;
  const isGuest = Boolean(initial.isGuest);
  const sample = getActiveSampleScenario(uid);
  if (!uid && !isGuest) throw new Error('Sign in or continue as Guest before exporting.');
  const assertCurrent = () => {
    const now = useAppStore.getState();
    if ((now.user?.uid || null) !== uid || Boolean(now.isGuest) !== isGuest
      || getActiveSampleScenario(uid) !== sample) {
      throw new Error('Your session changed. Reopen PDF Studio before exporting.');
    }
  };
  const scope = { uid, isGuest, sample: Boolean(sample), assertCurrent };
  const story = buildMomentStory(event, {
    momentTypes: momentTypes || initial.adminValues?.eventTypes || [],
  });
  const options = normalizePdfStudioOptions(studioOptions, story.presentation);
  const pdf = new MomentPdfPainter(assertCurrent, options);
  const template = options.template;
  const layout = [];
  // A cover photo is part of the book, not another copy in the body.
  const coverHero = options.includeCover && template === 'journey'
    ? story.keepsakes.find((item) => isAttachmentImage(item.type)) : null;
  if (options.includeCover) {
    pdf.y += 100;
    await pdf.text(PDF_TEMPLATE_NAMES[template].toUpperCase(), { size: 12, bold: true, color: palette.accent, after: 26 });
    await pdf.text(event.name || 'Untitled Moment', { size: 30, bold: true, color: palette.ink, leading: 1.26, after: 22 });
    await pdf.text(template === 'journey' ? 'Photographs and memories' : template === 'diary' ? 'A month in words' : 'Tasks and progress',
      { size: 14, color: palette.muted, after: 23 });
    if (story.momentDate) await pdf.text(studioDate(story.momentDate), { size: 12, color: palette.muted });
    if (coverHero) {
      const photo = await pdf.photo(coverHero, scope, {
        large: true, fitToRemaining: true, reserveAfter: 18,
      });
      if (photo) layout.push({ kind: 'cover', imagePage: photo.page });
    }
    await pdf.finishPage();
    pdf.begin();
  }
  await pdf.text(event.name || 'Untitled Moment', { size: template === 'chronicle' ? 21 : 24, bold: true, after: 10 });
  await pdf.text(`${PDF_TEMPLATE_NAMES[template]}  |  ${story.momentDate ? studioDate(story.momentDate) : 'No Moment date'}`,
    { size: 10, color: palette.muted, after: 18 });
  if (options.includeIntro && story.introduction) {
    await pdf.heading(template === 'journey' ? 'The opening page' : template === 'diary' ? 'This month' : 'About these tasks');
    await pdf.text(studioText(story.introduction), { size: 12, after: 17 });
  }
  if (options.includeIntro && template === 'journey' && event.greetingCard?.body) {
    await pdf.text(studioText(event.greetingCard.title || 'Greeting'), { size: 14, bold: true, after: 7 });
    await pdf.text(studioText(event.greetingCard.body), { size: 12, after: 14 });
  }

  if (template === 'journey') {
    const remainingKeepsakes = story.keepsakes.filter((item) => item !== coverHero);
    if (remainingKeepsakes.length) {
      await pdf.heading('Photographs to remember', { keepWithNext: 135 });
      await pdf.attachments(remainingKeepsakes, scope, {
        large: true, fitToRemaining: true, reserveAfter: 22,
      });
    }
    for (const month of story.timeline) for (const day of month.days) {
      const first = day.entries[0];
      const firstHasPhoto = first?.attachments?.some((item) => isAttachmentImage(item.type));
      await pdf.heading(studioDate(day.date), { keepWithNext: firstHasPhoto ? 330 : 105 });
      const datePage = pdf.pageNumber;
      for (const entry of day.entries) {
        const hasPhoto = entry.attachments?.some((item) => isAttachmentImage(item.type));
        // A new chapter must not leave its date/title at the page bottom.
        // Reserve date + title + a lead photograph and the start of its prose.
        if (hasPhoto && entry !== first) await pdf.ensure(300);
        if (!hasPhoto) await pdf.ensure(60);
        const titlePage = pdf.pageNumber;
        await pdf.text(studioText(entry.title || 'A memory'), { size: 16, bold: true, after: 9 });
        const photos = entry.attachments.filter((item) => isAttachmentImage(item.type));
        const lead = photos[0];
        const leadPosition = lead ? await pdf.photo(lead, scope, {
          large: true, fitToRemaining: true, reserveAfter: entry.description ? 100 : 35,
        }) : null;
        if (entry.description) await pdf.text(studioText(entry.description), {
          size: 12, leading: 1.58, after: 18,
        });
        if (photos.length > 1) {
          await pdf.attachments(photos.slice(1), scope, {
            large: true, fitToRemaining: true, reserveAfter: 20,
          });
        }
        // Original non-photo files remain recorded with their own Activity.
        for (const item of entry.attachments.filter((attachment) => !isAttachmentImage(attachment.type))) {
          await pdf.text('Other file: ' + (item.name || 'Attachment'), { size: 10, color: palette.muted });
        }
        layout.push({ kind: 'journal-entry', date: day.date, id: entry.id,
          datePage, titlePage, leadPhotoPage: leadPosition?.page ?? null });
      }
    }
  } else if (template === 'diary') {
    await pdf.heading(story.momentDate
      ? new Date(story.momentDate + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : 'Monthly entries');
    for (const day of story.timeline.flatMap((month) => month.days)) {
      await pdf.ensure(74);
      await pdf.text(studioDate(day.date), { size: 10, bold: true, color: palette.accent, after: 12 });
      for (const entry of day.entries) {
        await pdf.text(studioText(entry.title || 'Diary entry'), { size: 15, bold: true, after: 8 });
        if (entry.description) await pdf.text(studioText(entry.description), { size: 12, leading: 1.7, after: 20 });
      }
    }
  } else {
    for (const group of pdfStudioTaskSections(groupMomentStoryTasks(story), options)) {
      await pdf.heading(group.status === 'in-progress' ? 'In progress' : group.status === 'completed' ? 'Completed' : 'Cancelled');
      if (!group.entries.length) await pdf.text('No tasks in this section.', { size: 11, color: palette.muted });
      for (const entry of group.entries) {
        await pdf.ensure(43);
        await pdf.text(studioText(entry.title || 'Untitled task'), { size: 12, bold: true, after: 3 });
        const when = entry.date ? studioDate(entry.date) + (entry.displayTime ? '  ' + entry.displayTime : '') : 'No date';
        await pdf.text(when, { size: 9, color: palette.muted, after: 5 });
        if (entry.description) await pdf.text(studioText(entry.description), { size: 10.5, after: 12 });
      }
    }
  }
  if (template !== 'chronicle') {
    if (options.includeUpcoming && story.upcoming.length) {
      await pdf.heading('Upcoming');
      for (const entry of story.upcoming) {
        await pdf.text(studioDate(entry.date) + '  |  ' + studioText(entry.title || 'Future plan'), { size: 12, bold: true, after: 8 });
        if (entry.description) await pdf.text(studioText(entry.description), { size: 11, after: 12 });
      }
    }
    if (story.undated.length) {
      await pdf.heading('Without a recorded date');
      for (const entry of story.undated) {
        await pdf.text(studioText(entry.title || 'Untitled entry'), { size: 12, bold: true, after: 8 });
        if (entry.description) await pdf.text(studioText(entry.description), { size: 11, after: 12 });
      }
    }
  }
  if (options.includeReflections && story.reflections.length) {
    await pdf.heading('Earlier reflections');
    for (const item of story.reflections) {
      if (item.title) await pdf.text(studioText(item.title), { size: 13, bold: true, after: 6 });
      if (item.body) await pdf.text(studioText(item.body), { size: 11, after: 13 });
    }
  }
  assertCurrent();
  const output = await pdf.renderedPages();
  assertCurrent();
  return { ...output, options, filename: momentPdfFilename(event.name),
    // Per-entry page positions are read-only diagnostic evidence for pagination
    // tests; actual preview still displays the exact exported JPEG bytes.
    layout,
    scope: { uid, isGuest, sample: Boolean(sample) } };
}
