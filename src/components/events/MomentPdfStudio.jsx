import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, RefreshCw, SlidersHorizontal,
  Maximize2, Images, ZoomIn, ZoomOut, X, RotateCcw, CheckCircle2,
} from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import PdfContentSheet from './PdfContentSheet';
import usePersistentListState from '../../hooks/usePersistentListState';
import { PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES, pdfContentKey, projectPdfContent } from '../../utils/pdfContentSelection';
import DropdownSelect from '../common/DropdownSelect';
import useStoryDesignDefaults from '../../hooks/useStoryDesignDefaults';
import { getActiveSampleScenario } from '../../dev/sampleData';
import { resolveMomentStoryPresentation } from '../../utils/momentStory';
import {
  PDF_DENSITIES, PDF_TEMPLATES, PDF_STYLE_NAMES, PDF_PAGE_QUALITY_OPTIONS,
  PDF_PAGE_NUMBER_POSITIONS, normalizePdfStudioOptions,
} from '../../utils/pdfStudioOptions';
import { STORY_DESIGN_STYLES } from '../../utils/storyDesignPreferences';
import { renderMomentStudioPdf } from '../../utils/momentPdf';
import { downloadBlob } from '../../utils/download';
import './MomentPdfStudio.css';

const pageLayoutChoices = [
  { value: 'flow', title: 'Natural flow', description: 'Continue writing without extra page breaks.' },
  { value: 'day', title: 'New day, new page', description: 'Keep all Activities from the same date together.' },
  { value: 'activity', title: 'New activity, new page', description: 'Separate each saved Activity, even on the same date.' },
];

const optionLabels = [
  { key: 'includeCover', title: 'Cover page', help: 'A dedicated opening page' },
  { key: 'includeIntro', title: 'Introduction', help: 'Your Moment notes and opening words' },
  { key: 'includeReflections', title: 'Earlier reflections', help: 'Preserved older Memory notes, if any' },
  { key: 'includeUpcoming', title: 'Upcoming entries', help: 'Future plans without inventing new dates' },
  { key: 'includeCompleted', title: 'Completed tasks', help: 'Finished items after in-progress tasks' },
];
const zoomSteps = [1, 1.25, 1.5, 2];
const windowOfPages = (total, selected) => {
  const start = Math.min(Math.max(selected - 4, 0), Math.max(total - 9, 0));
  return Array.from({ length: Math.min(9, total) }, (_, offset) => start + offset);
};

export default function MomentPdfStudio({ event }) {
  const user = useAppStore(state => state.user);
  const sampleScope = getActiveSampleScenario(user?.uid || null) || 'personal';
  const [selection, saveSelection] = usePersistentListState(`pdf-content:${sampleScope}:${pdfContentKey(event)}`, PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES);
  const [contentOpen, setContentOpen] = useState(false);
  const content = projectPdfContent(event, selection);
  const customizedContent = selection.excludedActivities.length || selection.excludedAttachments.length;
  const momentTypes = useAppStore((state) => state.adminValues?.eventTypes || []);
  const savedStyles = useStoryDesignDefaults();
  const originalTemplate = resolveMomentStoryPresentation(event, momentTypes);
  const [settings, setSettings] = useState(() => normalizePdfStudioOptions({}, originalTemplate, savedStyles));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageJump, setPageJump] = useState('1');
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const requestRef = useRef(0);
  const urlsRef = useRef([]);
  const settingsRef = useRef(settings);
  const customizedRef = useRef(false);
  const styleOverrideRef = useRef(false);
  const dialogRef = useRef(null);
  const thumbnailRef = useRef(null);

  const renderPreview = useCallback(async (next) => {
    const id = ++requestRef.current;
    setBusy(true);
    setDirty(true);
    setError('');
    try {
      const result = await renderMomentStudioPdf(event, { ...next, contentSelection: selection }, { momentTypes });
      if (id !== requestRef.current) return;
      const urls = result.pages.map((page) => URL.createObjectURL(new Blob([page.bytes], { type: 'image/jpeg' })));
      if (id !== requestRef.current) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      const old = urlsRef.current;
      urlsRef.current = urls;
      setPreview({
        blob: result.blob, filename: result.filename, pageUrls: urls,
        scope: result.scope, options: result.options,
      });
      setPageIndex(0);
      setPageJump('1');
      setDirty(false);
      old.forEach((url) => URL.revokeObjectURL(url));
    } catch (renderError) {
      if (id === requestRef.current) setError(renderError?.message || 'Could not prepare this PDF preview.');
    } finally {
      if (id === requestRef.current) setBusy(false);
    }
  }, [event, momentTypes, selection]);

  // Refresh with the user's actual controls on source changes. Settings style
  // defaults follow the selected format unless this export has its own override.
  // No Moment or preference is modified by these temporary PDF controls.
  useEffect(() => {
    const next = customizedRef.current
      ? normalizePdfStudioOptions({
        ...settingsRef.current,
        visualStyle: styleOverrideRef.current ? settingsRef.current.visualStyle
          : savedStyles[settingsRef.current.template],
      }, originalTemplate, savedStyles)
      : normalizePdfStudioOptions({}, originalTemplate, savedStyles);
    settingsRef.current = next;
    setSettings(next);
    void renderPreview(next);
    return () => {
      requestRef.current += 1;
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, [renderPreview, originalTemplate, savedStyles]);

  const update = (key, value) => {
    requestRef.current += 1;
    setBusy(false);
    setDirty(true);
    setError('');
    const next = { ...settingsRef.current, ...(key === 'pageLayout'
      ? { pageBreakBetweenActivities: value === 'activity', pageBreakBetweenDays: value === 'day' }
      : { [key]: value }) };
    if (key === 'template' && value === 'chronicle') next.pageBreakBetweenDays = false;
    if (key === 'template' && !styleOverrideRef.current) {
      next.visualStyle = savedStyles[value];
    }
    if (key === 'visualStyle') styleOverrideRef.current = true;
    customizedRef.current = true;
    settingsRef.current = next;
    setSettings(next);
  };

  const changeChapterLayoutByKey = (event) => {
    const key = event.key;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const choices = pageLayoutChoices.filter((item) => item.value !== 'day'
      || settingsRef.current.template !== 'chronicle');
    const selected = settingsRef.current.pageBreakBetweenActivities ? 'activity'
      : settingsRef.current.pageBreakBetweenDays ? 'day' : 'flow';
    const current = Math.max(0, choices.findIndex((item) => item.value === selected));
    const nextIndex = key === 'Home' ? 0 : key === 'End' ? choices.length - 1
      : (current + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) + choices.length) % choices.length;
    if (selected !== choices[nextIndex].value) update('pageLayout', choices[nextIndex].value);
    event.currentTarget.querySelectorAll('[role="radio"]')[nextIndex]?.focus();
  };

  const restoreSavedStyle = () => {
    // Restore is not a manual style override. Do not pass through update(),
    // which intentionally marks visualStyle selections as customized.
    const next = {
      ...settingsRef.current,
      visualStyle: savedStyles[settingsRef.current.template],
    };
    requestRef.current += 1;
    setBusy(false);
    setDirty(true);
    setError('');
    styleOverrideRef.current = false;
    customizedRef.current = true;
    settingsRef.current = next;
    setSettings(next);
  };

  const download = () => {
    if (!preview || dirty || busy) return;
    const session = useAppStore.getState();
    const uid = session.user?.uid || null;
    const isGuest = Boolean(session.isGuest);
    if (preview.scope.uid !== uid || preview.scope.isGuest !== isGuest
      || preview.scope.sample !== Boolean(getActiveSampleScenario(uid))) {
      setError('Your session changed. Reopen PDF Studio before downloading.');
      return;
    }
    downloadBlob(preview.blob, preview.filename);
  };

  const zoom = zoomSteps[zoomIndex];
  const goToPage = (index) => {
    const next = Math.max(0, Math.min((preview?.pageUrls.length || 1) - 1, index));
    setPageIndex(next);
    setPageJump(String(next + 1));
  };
  const jumpToPage = (event) => {
    event.preventDefault();
    const target = Number(pageJump);
    if (Number.isSafeInteger(target) && target >= 1 && target <= (preview?.pageUrls.length || 0)) {
      goToPage(target - 1);
    } else {
      setPageJump(String(pageIndex + 1));
    }
  };
  const thumbnailPages = useMemo(() => windowOfPages(preview?.pageUrls.length || 0, pageIndex),
    [preview?.pageUrls.length, pageIndex]);
  useEffect(() => {
    if (!thumbsOpen || !thumbnailRef.current) return;
    const row = thumbnailRef.current;
    const selected = row.querySelector('[aria-current="page"]');
    if (selected) {
      const item = selected.getBoundingClientRect();
      const viewport = row.getBoundingClientRect();
      row.scrollLeft += (item.left + item.width / 2) - (viewport.left + viewport.width / 2);
    }
  }, [thumbsOpen, pageIndex, thumbnailPages]);
  const changeZoom = (direction) => setZoomIndex((current) =>
    Math.max(0, Math.min(zoomSteps.length - 1, current + direction)));

  const openFullscreen = () => {
    if (!preview || dirty || busy || !dialogRef.current) return;
    dialogRef.current.showModal();
  };

  const controls = (full = false) => <nav className="dn-pdf-page-nav"
    aria-label={full ? 'Fullscreen PDF page navigation' : 'PDF page navigation'}>
    <button type="button" disabled={!preview || pageIndex === 0} onClick={() => goToPage(pageIndex - 1)}
      aria-label={full ? 'Previous fullscreen page' : 'Previous PDF page'}>
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
    <form className="dn-pdf-page-jump" onSubmit={jumpToPage}>
      <label>Page <input type="number" inputMode="numeric" min="1"
        max={preview?.pageUrls.length || 1} value={pageJump}
        aria-label={full ? 'Jump to fullscreen PDF page' : 'Jump to PDF page'}
        onChange={(event) => setPageJump(event.target.value)} /></label>
      <span>of {preview?.pageUrls.length || 0}</span>
      <button type="submit" aria-label={full ? 'Go to fullscreen PDF page' : 'Go to PDF page'}
        disabled={!preview}>Go</button>
    </form>
    <button type="button" disabled={!preview || pageIndex >= preview.pageUrls.length - 1}
      onClick={() => goToPage(pageIndex + 1)}
      aria-label={full ? 'Next fullscreen page' : 'Next PDF page'}>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </nav>;

  return <section className="dn-pdf-studio-page" aria-label="PDF Studio">
    <div className="dn-pdf-studio">
      <section className="dn-pdf-studio-preview" aria-label="PDF page preview">
        <div className="dn-pdf-studio-preview-head">
          <div><strong>Your memory book</strong>
            <small>{PDF_STYLE_NAMES[preview?.options.visualStyle || settings.visualStyle]}
              {' · '}{PDF_TEMPLATES.find((item) => item.value === (preview?.options.template || settings.template))?.label || 'Story'}
              {' · '}A4 portrait
              {preview?.options.pageQuality !== 'standard'
                ? ' · ' + (PDF_PAGE_QUALITY_OPTIONS.find((item) =>
                  item.value === preview?.options.pageQuality)?.label || '') : ''}
              {preview?.options.searchableText ? ' · Searchable text' : ''}</small>
          </div>
          {preview ? <span className="dn-pdf-page-count">{preview.pageUrls.length}
            {preview.pageUrls.length === 1 ? ' page' : ' pages'}</span> : null}
        </div>
        {error ? <p className="dn-pdf-studio-error" role="alert">{error}</p> : null}
        {dirty && preview ? <p className="dn-pdf-studio-stale" role="status">Settings changed. Update the preview to download.</p> : null}
        {busy && !preview ? <p role="status" className="dn-pdf-studio-loading">Rendering your pages and original photos…</p> : null}
        {preview ? <>
          <div className="dn-pdf-preview-tools">
            <button type="button" onClick={() => setThumbsOpen((current) => !current)}
              aria-pressed={thumbsOpen} aria-label="Toggle PDF page thumbnails"
              title="Page thumbnails"><Images size={17} aria-hidden="true" /> Pages</button>
            <div className="dn-pdf-preview-zoom-controls" aria-label="PDF preview zoom">
              <button type="button" disabled={zoomIndex === 0} onClick={() => changeZoom(-1)} aria-label="Zoom out PDF preview">
                <ZoomOut size={17} aria-hidden="true" /></button>
              <button type="button" onClick={() => setZoomIndex(0)} aria-label="Reset PDF preview zoom">
                {Math.round(zoom * 100)}%</button>
              <button type="button" disabled={zoomIndex === zoomSteps.length - 1}
                onClick={() => changeZoom(1)} aria-label="Zoom in PDF preview">
                <ZoomIn size={17} aria-hidden="true" /></button>
            </div>
            <button type="button" onClick={openFullscreen} disabled={dirty || busy}
              aria-label="Open full-screen PDF preview" title="Full-screen preview">
              <Maximize2 size={17} aria-hidden="true" /></button>
          </div>
          <div className="dn-pdf-preview-viewport" aria-label="PDF document page" style={{ '--dn-preview-zoom': zoom }}>
            <div className="dn-pdf-preview-page">
              <img src={preview.pageUrls[pageIndex]} alt={'Rendered PDF page ' + (pageIndex + 1)} />
            </div>
          </div>
          {controls()}
          {thumbsOpen ? <div className="dn-pdf-thumbnail-browser">
            <div className="dn-pdf-thumbnail-tools">
              <button type="button" onClick={() => goToPage(0)} disabled={pageIndex === 0}
                aria-label="Go to first PDF page">First</button>
              <span>Pages {thumbnailPages[0] + 1}–{thumbnailPages[thumbnailPages.length - 1] + 1}
                {' of '}{preview.pageUrls.length}</span>
              <button type="button" onClick={() => goToPage(preview.pageUrls.length - 1)}
                disabled={pageIndex === preview.pageUrls.length - 1}
                aria-label="Go to last PDF page">Last</button>
            </div>
            <nav ref={thumbnailRef} className="dn-pdf-page-thumbnails" aria-label="PDF page thumbnails">
            {thumbnailPages.map((index) => <button type="button" key={index}
              aria-label={'Go to PDF page ' + (index + 1)}
              aria-current={index === pageIndex ? 'page' : undefined}
              onClick={() => goToPage(index)}>
              <img src={preview.pageUrls[index]} loading="lazy" alt="" />
              <span>{index + 1}</span>
            </button>)}
            </nav>
          </div> : null}
        </> : null}
        {!preview && !busy && !error ? <p className="dn-pdf-studio-loading">Choose Update preview to render your PDF.</p> : null}
        <div className="dn-pdf-studio-footer">
          <small>{dirty ? 'Generate an up-to-date preview to enable download.'
            : 'Preview uses the exact pages embedded in your PDF.'}</small>
          <button type="button" className="primaryButton" disabled={!preview || dirty || busy} onClick={download}
            aria-label="Download customized PDF"><Download size={16} aria-hidden="true" /> Download PDF</button>
        </div>
      </section>

      <section className="dn-pdf-studio-controls" aria-label="PDF customization">
        <div className="dn-pdf-studio-intro">
          <SlidersHorizontal size={19} aria-hidden="true" />
          <div><strong>Design your PDF</strong>
            <p>Customize the book. Preview before downloading.</p></div>
        </div>
        <div className="dn-pdf-update-rail" aria-label="PDF preview update status">
          {dirty || busy ? <>
            <small role="status">{busy ? 'Rendering your pages…' : 'Preview needs updating'}</small>
            <button type="button" className="secondaryButton dn-pdf-update-button"
              onClick={() => renderPreview(settings)} disabled={busy}>
              <RefreshCw size={16} aria-hidden="true" />
              {busy ? 'Rendering…' : 'Update preview'}
            </button>
          </> : <span className="dn-pdf-update-current" role="status">
            <CheckCircle2 size={17} aria-hidden="true" /> Preview is up to date
          </span>}
        </div>
        <div className="dn-pdf-studio-field">
          <span>Story format</span>
          <DropdownSelect aria-label="PDF story format" value={settings.template} disabled={busy}
            searchable={false} triggerLabel={PDF_TEMPLATES.find((item) => item.value === settings.template)?.label}
            onChange={(e) => update('template', e.target.value)}>
            {PDF_TEMPLATES.map((option) => <option value={option.value} key={option.value}>
              {option.label} · {option.description}
            </option>)}
          </DropdownSelect>
        </div>
        <fieldset className="dn-pdf-design-choices" disabled={busy}>
          <legend>Book design</legend>
          <div className="dn-pdf-style-grid">
            {STORY_DESIGN_STYLES.map((style) => <button type="button" key={style}
              className={'dn-pdf-style-option is-' + style + (settings.visualStyle === style ? ' is-selected' : '')}
              aria-pressed={settings.visualStyle === style}
              aria-label={'PDF design ' + PDF_STYLE_NAMES[style]}
              onClick={() => update('visualStyle', style)}>
              <span className="dn-pdf-style-swatch" aria-hidden="true">
                <span>THE MEMORY COLLECTION</span><strong>Our Story</strong><i/>
              </span>
              <span>{PDF_STYLE_NAMES[style]}</span>
            </button>)}
          </div>
          <div className="dn-pdf-style-default">
            <small>Saved default: {PDF_STYLE_NAMES[savedStyles[settings.template]]}</small>
            {settings.visualStyle !== savedStyles[settings.template] ? <button type="button" onClick={restoreSavedStyle} disabled={busy}>
              <RotateCcw size={14} aria-hidden="true" /> Use saved default</button> : null}
          </div>
        </fieldset>
        <fieldset className="dn-pdf-color-options" disabled={busy}>
          <legend>Page theme</legend>
          <div role="group" aria-label="PDF page theme">
            {['light', 'dark'].map((mode) => <button type="button" key={mode}
              aria-pressed={settings.colorMode === mode} onClick={() => update('colorMode', mode)}>
              {mode === 'light' ? 'Light' : 'Dark'}
            </button>)}
          </div>
          <p>Applies to the preview and downloaded PDF.</p>
        </fieldset>
        <div className="dn-pdf-studio-field">
          <span>Page spacing</span>
          <DropdownSelect aria-label="PDF page spacing" value={settings.density} disabled={busy}
            searchable={false}
            triggerLabel={settings.density.charAt(0).toUpperCase() + settings.density.slice(1)}
            onChange={(e) => update('density', e.target.value)}>
            {PDF_DENSITIES.map((value) => <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>)}
          </DropdownSelect>
        </div>
        <div className="dn-pdf-studio-field">
          <span>Page image quality</span>
          <DropdownSelect aria-label="PDF page image quality" value={settings.pageQuality}
            disabled={busy} searchable={false}
            triggerLabel={PDF_PAGE_QUALITY_OPTIONS.find((item) => item.value === settings.pageQuality)?.label}
            onChange={(e) => update('pageQuality', e.target.value)}>
            {PDF_PAGE_QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>
              {option.label} · {option.description}
            </option>)}
          </DropdownSelect>
          {settings.pageQuality !== 'standard' ? <small className="dn-pdf-quality-hint">
            Experimental high-resolution page rendering. It may use more device memory
            and create larger files. The original photo resolution still determines
            how much detail a print can show. For long books, choose Standard.
          </small> : null}
        </div>
        <fieldset className="dn-pdf-page-numbers" disabled={busy}>
          <legend>Page numbers</legend>
          <div className="dn-pdf-page-position-options" role="group" aria-label="PDF page numbering position">
            {PDF_PAGE_NUMBER_POSITIONS.map(({ value, label }) => <button type="button" key={value}
              className={settings.pageNumberPosition === value ? 'is-selected' : ''}
              aria-pressed={settings.pageNumberPosition === value}
              aria-label={'PDF page numbers ' + label}
              onClick={() => update('pageNumberPosition', value)}>{label}</button>)}
          </div>
          {settings.includeCover && settings.pageNumberPosition !== 'none' ? <label className="dn-pdf-studio-toggle dn-pdf-number-cover">
            <input type="checkbox" checked={settings.numberCoverPage}
              onChange={(e) => update('numberCoverPage', e.target.checked)} />
            <span><strong>Number the cover page</strong>
              <small>Turn off to begin with page 1 after the cover.</small></span>
          </label> : null}
          <p>Changes appear on the actual PDF pages after Update preview. Existing PDFs are unchanged.</p>
        </fieldset>
        <fieldset className="dn-pdf-pagination-option" disabled={busy}>
          <legend>Activity pagination</legend>
          <p className="dn-pdf-pagination-help">Choose where a fresh page begins. Same-day notes can stay together without becoming new Activities.</p>
          <div className="dn-pdf-break-choices" role="radiogroup" aria-label="Activity page layout"
            onKeyDown={changeChapterLayoutByKey}>
            {pageLayoutChoices.filter((item) => item.value !== 'day' || settings.template !== 'chronicle')
              .map(({ value, title, description }) => {
                const selected = settings.pageBreakBetweenActivities ? 'activity'
                  : settings.pageBreakBetweenDays ? 'day' : 'flow';
                return <button type="button" role="radio" key={value}
                  className={'dn-pdf-break-choice' + (selected === value ? ' is-selected' : '')}
                  aria-checked={selected === value} tabIndex={selected === value ? 0 : -1}
                  aria-label={value === 'activity' ? 'Start each Activity on a new PDF page'
                    : value === 'day' ? 'Start each recorded day on a new PDF page'
                      : 'Continue Activities on the same PDF page'}
                  onClick={() => update('pageLayout', value)}>
                <span className={'dn-pdf-break-illustration' + (value !== 'flow' ? ' is-chapters' : '')} aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className="dn-pdf-break-copy"><strong>{title}</strong><small>{description}</small></span>
                <span className="dn-pdf-break-check" aria-hidden="true">✓</span>
              </button>;
              })}
          </div>
          <p className="dn-pdf-pagination-note">Date-based chapters keep same-day Activities on the same page.
            Long writing always flows onto the next page when needed.</p>
        </fieldset>
        <fieldset className="dn-pdf-searchable-option">
          <legend>PDF text</legend>
          <label className="dn-pdf-studio-toggle">
            <input type="checkbox" checked={settings.searchableText}
              onChange={(e) => update('searchableText', e.target.checked)} disabled={busy}
              aria-label="Add searchable writing to PDF" />
            <span><strong>Searchable writing (experimental)</strong>
              <small>Add selectable/searchable source text without OCR. Pages
                remain image-based; this does not increase printing resolution.</small></span>
          </label>
        </fieldset>
        <button type="button" className="dn-pdf-content-launch" onClick={() => setContentOpen(true)} disabled={busy}>
          <span>Content</span><small>{customizedContent
            ? `${content.activities.length} activities · ${content.attachments.length} attachments`
            : 'All eligible items'}</small><ChevronRight size={17} aria-hidden="true" />
        </button>
        {contentOpen ? <PdfContentSheet event={event} selection={selection}
          onClose={() => setContentOpen(false)} onApply={next => { saveSelection(next); setContentOpen(false); }} /> : null}
        <details className="dn-pdf-content-options">
          <summary><span>Book sections</span>
            <small>{optionLabels.filter(({ key }) => settings.template === 'chronicle'
              ? key !== 'includeUpcoming' : !['includeCompleted', 'includeCancelled'].includes(key))
              .filter(({ key }) => settings[key]).length} selected · Customize</small>
          </summary>
          <fieldset className="dn-pdf-studio-sections">
            <legend>Include in the PDF</legend>
            {optionLabels.filter(({ key }) => settings.template === 'chronicle'
              ? key !== 'includeUpcoming' : !['includeCompleted', 'includeCancelled'].includes(key))
              .map(({ key, title, help }) => <label key={key} className="dn-pdf-studio-toggle">
                <input type="checkbox" checked={settings[key]}
                  onChange={(e) => update(key, e.target.checked)} disabled={busy} />
                <span><strong>{title}</strong><small>{help}</small></span>
              </label>)}
          </fieldset>
        </details>
        <p className="dn-pdf-studio-format-note">These design choices affect only this PDF.
          Your Settings defaults and original memories stay unchanged.</p>
      </section>
    </div>
    <dialog className="dn-pdf-fullscreen-dialog" ref={dialogRef}
      aria-label="Full-screen PDF preview">
      <div className="dn-pdf-fullscreen-head">
        <strong>PDF preview</strong>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close full-screen PDF preview">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {preview ? <>
        <div className="dn-pdf-fullscreen-viewport">
          <img src={preview.pageUrls[pageIndex]} alt={'Fullscreen PDF page ' + (pageIndex + 1)} />
        </div>
        {controls(true)}
      </> : null}
    </dialog>
  </section>;
}
