const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
const nonnegative = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

// Safari's keyboard can resize/pan the visual viewport without changing dvh.
// Manual pinch zoom keeps the layout size instead of making the form reflow.
export function getDialogViewportBounds(win) {
  const width = positive(win.innerWidth, positive(win.document?.documentElement?.clientWidth, 1));
  const height = positive(win.innerHeight, positive(win.document?.documentElement?.clientHeight, 1));
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
  const visual = win.visualViewport;
  const flush = () => { frame = null; update(getDialogViewportBounds(win)); };
  const schedule = () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(flush);
  };
  visual?.addEventListener('resize', schedule);
  visual?.addEventListener('scroll', schedule);
  win.addEventListener('resize', schedule);
  flush();
  return () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    visual?.removeEventListener('resize', schedule);
    visual?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
  };
}
