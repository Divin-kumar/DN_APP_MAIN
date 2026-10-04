import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

export const readLegacyCodeLists = () => {
  try {
    const raw = localStorage.getItem('lifehub_admin_values');
    if (!raw) return { ...DEFAULT_CODE_LISTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CODE_LISTS };
    return { ...DEFAULT_CODE_LISTS, ...parsed };
  } catch {
    return { ...DEFAULT_CODE_LISTS };
  }
};

export const readLegacyCodeListVersion = () => {
  const raw = localStorage.getItem('lifehub_admin_values_schema_version');
  return raw === null ? 0 : Number(raw) || 0;
};
