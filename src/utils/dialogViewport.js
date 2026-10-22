const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const nonnegative = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function getDialogLayoutSize(win) {
  return {
    width: positive(win.document?.documentElement?.clientWidth, positive(win.innerWidth, 1)),
    height: Math.max(positive(win.document?.documentElement?.clientHeight, 1), positive(win.innerHeight, 1)),
  };
}

// Safari's keyboard can resize/pan the visual viewport without changing dvh.
// Manual pinch zoom keeps the layout size instead of making the form reflow.
export function getDialogViewportBounds(win, layout = getDialogLayoutSize(win)) {
  const { width, height } = layout;
  const visual = win.visualViewport;
  if (!visual || Math.abs(positive(visual.scale, 1) - 1) > 0.05) {
    return { width, height, left: 0, top: 0, keyboardOpen: false };
  }
  const visibleWidth = Math.min(width, positive(visual.width, width));
  const visibleHeight = Math.min(height, positive(visual.height, height));
  return {
    width: visibleWidth,
    height: visibleHeight,
    left: Math.min(nonnegative(visual.offsetLeft), Math.max(0, width - visibleWidth)),
    top: Math.min(nonnegative(visual.offsetTop), Math.max(0, height - visibleHeight)),
    keyboardOpen: height - visibleHeight > 120,
  };
}

export function observeDialogViewport(win, update) {
  let frame = null;
  let layout = getDialogLayoutSize(win);
  const visual = win.visualViewport;
  const flush = () => {
    frame = null;
    const next = getDialogLayoutSize(win);
    // Some iOS versions resize innerHeight/clientHeight during focus. Keep the
    // layout reference until width changes (orientation/window-width change).
    layout = { width: next.width, height: visual && next.width === layout.width ? Math.max(layout.height, next.height) : next.height };
    update(getDialogViewportBounds(win, layout), layout);
  };
  const schedule = () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(flush);
  };
  visual?.addEventListener('resize', schedule);
  visual?.addEventListener('scroll', schedule);
  win.addEventListener('resize', schedule);
  win.addEventListener('scroll', schedule);
  win.document?.addEventListener?.('focusin', schedule);
  win.document?.addEventListener?.('focusout', schedule);
  flush();
  return () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    visual?.removeEventListener('resize', schedule);
    visual?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('scroll', schedule);
    win.document?.removeEventListener?.('focusin', schedule);
    win.document?.removeEventListener?.('focusout', schedule);
  };
}
