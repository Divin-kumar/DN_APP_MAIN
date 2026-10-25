import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ImageOff, Images, Move } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAttachmentOriginal from '../../../hooks/useAttachmentOriginal';
import usePersistentListState from '../../../hooks/usePersistentListState';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import ModalDialog from '../../../components/common/ModalDialog';
import { activityCoverImages, activityCoverRatio, coverImageKey } from '../../../utils/activityDetail';
import { COVER_POSITION_DEFAULTS, COVER_POSITION_RULES, clampCoverPosition, dragCoverPosition } from '../../../utils/activityCoverPosition';

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
  const frame = useRef(null), gesture = useRef(null), wasEditing = useRef(false);
  const help = useId();
  const usable = original.source && !original.error && brokenSource !== original.source;
  const loading = original.loading;
  const shown = editing ? draft : position;
  const finish = (save = false) => {
    if (save) savePosition(draft);
    setEditing(false); onEditingChange?.(false); gesture.current = null;
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
      if (!editing || event.button !== 0 || event.target.closest('button, a')) return;
      event.preventDefault(); frame.current.setPointerCapture(event.pointerId);
      gesture.current = { x: event.clientX, y: event.clientY, position: draft, frame: frame.current.getBoundingClientRect() };
    }}
    onPointerMove={(event) => {
      if (!gesture.current) return;
      const start = gesture.current;
      setDraft(dragCoverPosition(start.position, { x: event.clientX - start.x, y: event.clientY - start.y }, start.frame, natural));
    }} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}
    onKeyDown={(event) => {
      if (!editing || event.target !== event.currentTarget) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); setDraft((value) => ({ x: clampCoverPosition(value.x + (event.key === 'ArrowLeft' ? 5 : event.key === 'ArrowRight' ? -5 : 0)),
          y: clampCoverPosition(value.y + (event.key === 'ArrowUp' ? 5 : event.key === 'ArrowDown' ? -5 : 0)) }));
      } else if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Enter'); }
    }}>
    {usable ? <img className="activity-cover-photo" src={original.source} draggable={false}
      style={{ objectPosition: `${shown.x}% ${shown.y}%` }} alt={attachment.name || 'Attached activity photo'} width={geometry.width} height={geometry.height}
      onLoad={(event) => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
        if (width && height) { if (dimensions.size < 100) dimensions.set(identity, { width, height }); setNatural({ width, height }); setReadySource(original.source); }
      }} onError={() => setBrokenSource(original.source)} /> : <div className="activity-cover-fallback">
      <span aria-hidden="true">{attachment && !loading ? <ImageOff size={28} /> : <Images size={28} />}</span>
      <small className="sr-only">{loading ? 'Loading photo…' : attachment ? 'Cover photo unavailable' : 'No cover photo'}</small>
    </div>}
    {editing ? <>
      <p id={help} className="sr-only">Drag the photo or use arrow keys. Enter saves; Escape cancels.</p>
      <div className="activity-cover-controls"><button type="button" onClick={() => finish(false)}>Cancel</button><button type="button" onClick={() => finish(true)}>Done</button></div>
    </> : <>
      <Link to={backTo} className="activity-cover-back" aria-label="Back to Moment activities"><ArrowLeft size={19} aria-hidden="true" /></Link>
      <div className="activity-cover-controls">
        {onChoose ? <button type="button" aria-label="Choose cover photo" title="Choose cover photo" onClick={onChoose}><Images size={18} aria-hidden="true" /></button> : null}
        {usable && readySource === original.source ? <button type="button" aria-label="Reposition cover photo" title="Reposition cover photo" onClick={() => { setDraft(position); setEditing(true); onEditingChange?.(true); }}><Move size={18} aria-hidden="true" /></button> : null}
      </div>
    </>}
  </div>;
}
