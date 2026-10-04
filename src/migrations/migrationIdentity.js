export const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const fnv64 = (value) => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0));
    hash = (hash * prime) & mask;
  }
  return hash.toString(36);
};

export const deterministicMigrationId = (namespace, sourcePath, originalId, fallback = '') => {
  const material = [namespace, sourcePath, originalId ?? '', fallback].join('|');
  return `mig_${fnv64(material)}`;
};

export const canonicalFingerprint = async (value) => {
  const serialized = stableStringify(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 is unavailable; migration integrity checks cannot run.');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const createSourceFingerprint = async (sources) => canonicalFingerprint(sources);
