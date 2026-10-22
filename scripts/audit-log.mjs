// Preserve historical entry text while allowing the owner-required newest-first order.
export const parseAuditEntries = (source) => {
  const text = source.replace(/\r\n/g, '\n');
  const headings = [...text.matchAll(/^## (CHG-\d{8}-\d{3}) \| .+$/gm)];
  const candidates = [...text.matchAll(/^## CHG-/gm)];
  if (headings.length !== candidates.length) throw new Error('Malformed CHG heading.');
  const entries = new Map();
  headings.forEach((heading, index) => {
    const id = heading[1];
    if (entries.has(id)) throw new Error(`Duplicate audit entry: ${id}`);
    entries.set(id, text.slice(heading.index, headings[index + 1]?.index ?? text.length).trimEnd());
  });
  return entries;
};

export const verifyAuditLog = (previousSource, currentSource) => {
  const previous = parseAuditEntries(previousSource);
  const current = parseAuditEntries(currentSource);
  const ids = [...current.keys()];
  if (!ids.length) throw new Error('The audit log must contain entries.');
  for (let index = 1; index < ids.length; index += 1) {
    if (ids[index - 1] <= ids[index]) throw new Error('Audit entries must be newest first.');
  }
  for (const [id, content] of previous) {
    if (!current.has(id)) throw new Error(`Audit history was removed: ${id}`);
    if (current.get(id) !== content) throw new Error(`Audit history was edited: ${id}`);
  }
  const added = ids.filter((id) => !previous.has(id));
  if (!added.length) throw new Error('Each OldVersion change requires a new CHG entry at the top.');
  if (ids.slice(0, added.length).some((id) => previous.has(id))) {
    throw new Error('New audit entries must precede historical entries.');
  }
  return { preserved: previous.size, added: added.length };
};
