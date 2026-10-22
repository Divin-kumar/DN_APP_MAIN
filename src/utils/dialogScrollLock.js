const documentLocks = new WeakMap();
const bodyProperties = ['position', 'top', 'left', 'right', 'width', 'overflow'];
const rootProperties = ['overflow', 'overscroll-behavior'];

const rememberStyles = (style, properties) => properties.map((property) => ({
  property,
  value: style.getPropertyValue(property),
  priority: style.getPropertyPriority(property),
}));

const restoreStyles = (style, properties) => {
  for (const { property, value, priority } of properties) {
    if (value) style.setProperty(property, value, priority);
    else style.removeProperty(property);
  }
};

// A fixed body prevents mobile focus from scrolling the page beneath a dialog.
// Nested dialogs share one snapshot, which the last release restores.
export function lockDialogScroll(win) {
  const document = win.document;
  let lock = documentLocks.get(document);

  if (!lock) {
    const body = document.body;
    const root = document.documentElement;
    const left = Number.isFinite(win.scrollX) ? win.scrollX : 0;
    const top = Number.isFinite(win.scrollY) ? win.scrollY : 0;
    lock = {
      count: 0,
      body,
      root,
      bodyStyles: rememberStyles(body.style, bodyProperties),
      rootStyles: rememberStyles(root.style, rootProperties),
      hadClass: body.classList.contains('dn-modal-open'),
      left,
      top,
      win,
    };
    documentLocks.set(document, lock);

    for (const [property, value] of Object.entries({
      position: 'fixed', top: `${-top}px`, left: `${-left}px`,
      right: 'auto', width: '100%', overflow: 'hidden',
    })) body.style.setProperty(property, value, 'important');
    root.style.setProperty('overflow', 'hidden', 'important');
    root.style.setProperty('overscroll-behavior', 'none', 'important');
    body.classList.add('dn-modal-open');
  }

  lock.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count) return;

    documentLocks.delete(document);
    restoreStyles(lock.body.style, lock.bodyStyles);
    restoreStyles(lock.root.style, lock.rootStyles);
    if (!lock.hadClass) lock.body.classList.remove('dn-modal-open');
    lock.win.scrollTo({ left: lock.left, top: lock.top, behavior: 'instant' });
  };
}
