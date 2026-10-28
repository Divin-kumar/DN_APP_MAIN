import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import useAppStore from '../../store/useAppStore';
import { getActiveSampleScenario } from '../../dev/sampleData';
import { resolveMomentStoryPresentation } from '../../utils/momentStory';
import { PDF_DENSITIES, PDF_TEMPLATES, normalizePdfStudioOptions } from '../../utils/pdfStudioOptions';
import { renderMomentStudioPdf } from '../../utils/momentPdf';
import { downloadBlob } from '../../utils/download';
import './MomentPdfStudio.css';

const optionLabels = [
  { key: 'includeCover', title: 'Cover page', help: 'A dedicated opening page' },
  { key: 'includeIntro', title: 'Introduction', help: 'Your Moment notes and opening words' },
  { key: 'includeReflections', title: 'Earlier reflections', help: 'Preserved older Memory notes, if any' },
  { key: 'includeUpcoming', title: 'Upcoming entries', help: 'Future plans without inventing new dates' },
  { key: 'includeCompleted', title: 'Completed tasks', help: 'Finished items after in-progress tasks' },
  { key: 'includeCancelled', title: 'Cancelled tasks', help: 'Show cancelled entries at the end' },
];

export default function MomentPdfStudio({ event, onClose }) {
  const momentTypes = useAppStore((state) => state.adminValues?.eventTypes || []);
  const originalTemplate = resolveMomentStoryPresentation(event, momentTypes);
  const [settings, setSettings] = useState(() => normalizePdfStudioOptions({}, originalTemplate));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const requestRef = useRef(0);
  const urlsRef = useRef([]);
  const settingsRef = useRef(settings);
  const customizedRef = useRef(false);

  const renderPreview = useCallback(async (next) => {
    const id = ++requestRef.current;
    setBusy(true);
    setError('');
    try {
      const result = await renderMomentStudioPdf(event, next, { momentTypes });
      if (id !== requestRef.current) return;
      const urls = result.pages.map((page) => URL.createObjectURL(new Blob([page.bytes], { type: 'image/jpeg' })));
      if (id !== requestRef.current) {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      const old = urlsRef.current;
      urlsRef.current = urls;
      setPreview({ blob: result.blob, filename: result.filename, pageUrls: urls, scope: result.scope });
      setPageIndex(0);
      setDirty(false);
      old.forEach((url) => URL.revokeObjectURL(url));
    } catch (renderError) {
      if (id === requestRef.current) setError(renderError?.message || 'Could not prepare this PDF preview.');
    } finally {
      if (id === requestRef.current) setBusy(false);
    }
  }, [event, momentTypes]);

  // Opening Studio prepares real pages. A source/Code List refresh must use the
  // same choices shown by the controls, rather than silently exporting defaults.
  // User changes still wait for an explicit "Update preview".
  useEffect(() => {
    const next = customizedRef.current ? settingsRef.current
      : normalizePdfStudioOptions({}, originalTemplate);
    settingsRef.current = next;
    setSettings(next);
    void renderPreview(next);
    return () => {
      requestRef.current += 1;
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, [renderPreview, originalTemplate]);

  const update = (key, value) => {
    requestRef.current += 1;
    setBusy(false);
    setDirty(true);
    setError('');
    const next = { ...settingsRef.current, [key]: value };
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

  return <ModalDialog title="PDF Studio" className="dn-pdf-studio-dialog" onClose={onClose}>
    <div className="dn-pdf-studio">
      <section className="dn-pdf-studio-controls" aria-label="PDF customization">
        <div className="dn-pdf-studio-intro">
          <SlidersHorizontal size={19} aria-hidden="true" />
          <div><strong>Make it yours</strong><p>Adjust the pages before saving your Moment as a PDF.</p></div>
        </div>
        <label className="dn-pdf-studio-field">
          <span>Story format</span>
          <select aria-label="PDF story format" value={settings.template} disabled={busy}
            onChange={(eventValue) => update('template', eventValue.target.value)}>
            {PDF_TEMPLATES.map((option) => <option value={option.value} key={option.value}>
              {option.label} · {option.description}
            </option>)}
          </select>
        </label>
        <label className="dn-pdf-studio-field">
          <span>Page spacing</span>
          <select aria-label="PDF page spacing" value={settings.density} disabled={busy}
            onChange={(eventValue) => update('density', eventValue.target.value)}>
            {PDF_DENSITIES.map((value) => <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>)}
          </select>
        </label>
        <fieldset className="dn-pdf-studio-sections">
          <legend>Include in the PDF</legend>
          {optionLabels.filter(({ key }) => settings.template === 'chronicle'
            ? !['includeUpcoming'].includes(key) : !['includeCompleted', 'includeCancelled'].includes(key))
            .map(({ key, title, help }) =>
              <label key={key} className="dn-pdf-studio-toggle">
                <input type="checkbox" checked={settings[key]} onChange={(change) => update(key, change.target.checked)} disabled={busy} />
                <span><strong>{title}</strong><small>{help}</small></span>
              </label>)}
        </fieldset>
        <button type="button" className="secondaryButton dn-pdf-update-button" onClick={() => renderPreview(settings)} disabled={busy || !dirty}>
          <RefreshCw size={16} aria-hidden="true" /> {busy ? 'Rendering pages…' : dirty ? 'Update preview' : 'Preview is current'}
        </button>
      </section>
      <section className="dn-pdf-studio-preview" aria-label="PDF page preview">
        <div className="dn-pdf-studio-preview-head">
          <div><strong>Page preview</strong><small>Actual pages used in the downloaded PDF</small></div>
          {preview ? <span className="dn-pdf-page-count">{preview.pageUrls.length} {preview.pageUrls.length === 1 ? 'page' : 'pages'}</span> : null}
        </div>
        {error ? <p className="dn-pdf-studio-error" role="alert">{error}</p> : null}
        {dirty && preview ? <p className="dn-pdf-studio-stale" role="status">Settings changed. Update the preview to download.</p> : null}
        {busy && !preview ? <p role="status" className="dn-pdf-studio-loading">Rendering your pages and original photos…</p> : null}
        {preview ? <>
          <div className="dn-pdf-preview-page">
            <img src={preview.pageUrls[pageIndex]} alt={'Rendered PDF page ' + (pageIndex + 1)} />
          </div>
          <nav className="dn-pdf-page-nav" aria-label="PDF page navigation">
            <button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
              aria-label="Previous PDF page"><ChevronLeft size={18} aria-hidden="true" /></button>
            <span>Page {pageIndex + 1} of {preview.pageUrls.length}</span>
            <button type="button" disabled={pageIndex >= preview.pageUrls.length - 1}
              onClick={() => setPageIndex((index) => Math.min(preview.pageUrls.length - 1, index + 1))}
              aria-label="Next PDF page"><ChevronRight size={18} aria-hidden="true" /></button>
          </nav>
        </> : null}
        {!preview && !busy && !error ? <p className="dn-pdf-studio-loading">Choose Update preview to render your PDF.</p> : null}
        <div className="dn-pdf-studio-footer">
          <small>{dirty ? 'Generate an up-to-date preview to enable download.' : 'What you see is what your PDF contains.'}</small>
          <button type="button" className="primaryButton" disabled={!preview || dirty || busy} onClick={download}
            aria-label="Download customized PDF"><Download size={16} aria-hidden="true" /> Download PDF</button>
        </div>
      </section>
    </div>
  </ModalDialog>;
}
