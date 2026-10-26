import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ImageOff, Images, Minus, Move, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAttachmentOriginal from '../../../hooks/useAttachmentOriginal';
import usePersistentListState from '../../../hooks/usePersistentListState';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import ModalDialog from '../../../components/common/ModalDialog';
import { activityCoverImages, activityCoverRatio, coverImageKey } from '../../../utils/activityDetail';
import { COVER_POSITION_DEFAULTS, COVER_POSITION_RULES, COVER_ZOOM_MIN, COVER_ZOOM_MAX, clampCoverPosition, dragCoverPosition, zoomCoverPosition } from '../../../utils/activityCoverPosition';

const dimensions = new Map();
const SELECTION_DEFAULTS = Object.freeze({ imageKey: '' });
export default function ActivityCover({ moment, activityId, uid, isGuest, backTo, preferenceKey, onEditingChange }) {
  const [selection, select] = usePersistentListState(preferenceKey, SELECTION_DEFAULTS);
  const [choosing, setChoosing] = useState(false);
  const root = useRef(null), restoreChoiceFocus = useRef(false);
  const photos = activityCoverImages(moment, activityId);
  const selected = photos.find((item) => coverImageKey(item) === selection.imageKey) || photos[0] || null;
  useEffect(() => {
    if (restoreChoiceFocus.current && !choosing) {
      restoreChoiceFocus.current = false;
      root.current?.querySelector('[aria-label="Choose cover photo"]')?.focus({ preventScroll: true });
    }
  }, [choosing, selection.imageKey]);
  return <div ref={root} className="activity-hero">
    <CoverImage key={coverImageKey(selected)} attachment={selected} uid={uid} isGuest={isGuest} backTo={backTo}
      preferenceKey={`${preferenceKey}:position:${coverImageKey(selected)}`} onEditingChange={onEditingChange}
      onChoose={photos.length > 1 ? () => setChoosing(true) : null} />
    {choosing ? <ModalDialog title="Choose cover photo" className="activity-cover-picker" onClose={() => setChoosing(false)}>
      <AttachmentGallery attachments={photos} uid={uid} isGuest={isGuest} selectedKey={coverImageKey(selected)}
        onSelect={(image) => { restoreChoiceFocus.current = true; select({ imageKey: coverImageKey(image) }); setChoosing(false); }} />
    </ModalDialog> : null}
  </div>;
}

function CoverImage({ attachment, uid, isGuest, backTo, preferenceKey, onChoose, onEditingChange }) {
  const original = useAttachmentOriginal(attachment, { uid, isGuest });
  const [position, savePosition] = usePersistentListState(preferenceKey, COVER_POSITION_DEFAULTS, COVER_POSITION_RULES);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(position);
  const [brokenSource, setBrokenSource] = useState('');
  const [readySource, setReadySource] = useState('');
  const identity = coverImageKey(attachment);
  const initial = attachment?.width && attachment?.height ? attachment : dimensions.get(identity);
  const [geometry] = useState(() => ({ width: initial?.width, height: initial?.height, ratio: activityCoverRatio(initial?.width, initial?.height) }));
  const [natural, setNatural] = useState(initial || {});
  const frame = useRef(null), gesture = useRef(null), wasEditing = useRef(false), pointers = useRef(new Map()), draftRef = useRef(draft);
  const help = useId();
  const usable = original.source && !original.error && brokenSource !== original.source;
  const loading = original.loading;
  const shown = editing ? draft : position;
  const changeDraft = (next) => {
    const value = typeof next === 'function' ? next(draftRef.current) : next;
    draftRef.current = value; setDraft(value);
  };
  const beginEditing = () => {
    changeDraft(position); setEditing(true); onEditingChange?.(true);
  };
  const zoom = (value) => changeDraft(zoomCoverPosition(draftRef.current, value, frame.current.getBoundingClientRect(), natural));
  const finish = (save = false) => {
    if (save) savePosition(draftRef.current);
    setEditing(false); onEditingChange?.(false); gesture.current = null; pointers.current.clear();
  };
  const endPointer = (event, cancelled = false) => {
    pointers.current.delete(event.pointerId);
    if (frame.current.hasPointerCapture(event.pointerId)) frame.current.releasePointerCapture(event.pointerId);
    if (cancelled) pointers.current.clear();
    const remaining = [...pointers.current.entries()][0];
    gesture.current = editing && remaining ? { kind: 'drag', pointer: remaining[0], ...remaining[1], position: draftRef.current,
      frame: frame.current.getBoundingClientRect() } : null;
  };
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);
  useEffect(() => {
    if (editing) frame.current?.focus({ preventScroll: true });
    else if (wasEditing.current) frame.current?.querySelector('[aria-label="Reposition cover photo"]')?.focus({ preventScroll: true });
    wasEditing.current = editing;
  }, [editing]);
  return <div ref={frame} className={`activity-cover${loading ? ' is-loading' : ''}${usable ? ' has-photo' : ' is-fallback'}${editing ? ' is-repositioning' : ''}`}
    style={{ '--activity-cover-ratio': geometry.ratio }} aria-busy={Boolean(loading)} tabIndex={editing ? 0 : -1}
    role={editing ? 'group' : undefined} aria-label={editing ? 'Reposition cover photo' : undefined} aria-describedby={editing ? help : undefined}
    onPointerDown={(event) => {
      if (!usable || readySource !== original.source || event.button !== 0 || event.target.closest('button, a')) return;
      if (!editing && event.pointerType !== 'touch') return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const active = [...pointers.current.values()];
      if (active.length >= 2) {
        event.preventDefault();
        if (!editing) beginEditing();
        for (const pointer of pointers.current.keys()) frame.current.setPointerCapture(pointer);
        const center = { x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 };
        gesture.current = { kind: 'pinch', position: draftRef.current, center,
          distance: Math.max(1, Math.hypot(active[1].x - active[0].x, active[1].y - active[0].y)), frame: frame.current.getBoundingClientRect() };
      } else if (editing) {
        event.preventDefault(); frame.current.setPointerCapture(event.pointerId);
        gesture.current = { kind: 'drag', pointer: event.pointerId, x: event.clientX, y: event.clientY, position: draftRef.current,
          frame: frame.current.getBoundingClientRect() };
      }
    }}
    onPointerMove={(event) => {
      if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const start = gesture.current;
      if (!start) return;
      if (start.kind === 'pinch') {
        const active = [...pointers.current.values()];
        if (active.length < 2) return;
        event.preventDefault();
        const center = { x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 };
        const distance = Math.hypot(active[1].x - active[0].x, active[1].y - active[0].y);
        const next = zoomCoverPosition(start.position, start.position.zoom * distance / start.distance, start.frame, natural,
          { x: start.center.x - start.frame.left, y: start.center.y - start.frame.top });
        changeDraft(dragCoverPosition(next, { x: center.x - start.center.x, y: center.y - start.center.y }, start.frame, natural));
      } else if (start.pointer === event.pointerId) {
        event.preventDefault(); changeDraft(dragCoverPosition(start.position, { x: event.clientX - start.x, y: event.clientY - start.y }, start.frame, natural));
      }
    }} onPointerUp={endPointer} onPointerCancel={(event) => endPointer(event, true)}
    onKeyDown={(event) => {
      if (!editing || event.target !== event.currentTarget) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); changeDraft((value) => ({ ...value, x: clampCoverPosition(value.x + (event.key === 'ArrowLeft' ? 5 : event.key === 'ArrowRight' ? -5 : 0)),
          y: clampCoverPosition(value.y + (event.key === 'ArrowUp' ? 5 : event.key === 'ArrowDown' ? -5 : 0)) }));
      } else if (['+', '=', '-', '_'].includes(event.key)) {
        event.preventDefault(); zoom(draftRef.current.zoom + (['+', '='].includes(event.key) ? .25 : -.25));
      } else if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Enter'); }
    }}>
    {usable ? <img className="activity-cover-photo" src={original.source} draggable={false}
      style={{ objectPosition: `${shown.x}% ${shown.y}%`, width: `${shown.zoom * 100}%`, height: `${shown.zoom * 100}%`,
        left: `${(1 - shown.zoom) * shown.x}%`, top: `${(1 - shown.zoom) * shown.y}%` }} data-cover-zoom={shown.zoom}
      alt={attachment.name || 'Attached activity photo'} width={geometry.width} height={geometry.height}
      onLoad={(event) => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
        if (width && height) { if (dimensions.size < 100) dimensions.set(identity, { width, height }); setNatural({ width, height }); setReadySource(original.source); }
      }} onError={() => setBrokenSource(original.source)} /> : <div className="activity-cover-fallback">
      <span aria-hidden="true">{attachment && !loading ? <ImageOff size={28} /> : <Images size={28} />}</span>
      <small className="sr-only">{loading ? 'Loading photo…' : attachment ? 'Cover photo unavailable' : 'No cover photo'}</small>
    </div>}
    {editing ? <>
      <p id={help} className="sr-only">Drag the photo or use arrow keys to move. Pinch or use the zoom buttons to zoom. Enter saves; Escape cancels.</p>
      <div className="activity-cover-controls activity-cover-zoom" role="group" aria-label="Cover photo zoom">
        <button type="button" aria-label="Zoom out cover photo" disabled={draft.zoom <= COVER_ZOOM_MIN} onClick={() => zoom(draftRef.current.zoom - .25)}><Minus size={18} aria-hidden="true" /></button>
        <output aria-label="Cover photo zoom level">{Math.round(draft.zoom * 100)}%</output>
        <button type="button" aria-label="Zoom in cover photo" disabled={draft.zoom >= COVER_ZOOM_MAX} onClick={() => zoom(draftRef.current.zoom + .25)}><Plus size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Reset cover photo" onClick={() => changeDraft({ ...COVER_POSITION_DEFAULTS })}>Reset</button>
      </div>
      <div className="activity-cover-controls"><button type="button" onClick={() => finish(false)}>Cancel</button><button type="button" onClick={() => finish(true)}>Done</button></div>
    </> : <>
      <Link to={backTo} className="activity-cover-back" aria-label="Back to Moment activities"><ArrowLeft size={19} aria-hidden="true" /></Link>
      <div className="activity-cover-controls">
        {onChoose ? <button type="button" aria-label="Choose cover photo" title="Choose cover photo" onClick={onChoose}><Images size={18} aria-hidden="true" /></button> : null}
        {usable && readySource === original.source ? <button type="button" aria-label="Reposition cover photo" title="Reposition cover photo" onClick={beginEditing}><Move size={18} aria-hidden="true" /></button> : null}
      </div>
    </>}
  </div>;
}
