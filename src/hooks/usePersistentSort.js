import useAppStore from '../store/useAppStore';

const validDirection = (direction) => (direction === 'desc' ? 'desc' : 'asc');

export default function usePersistentSort(listKey, defaultField, defaultDirection = 'asc') {
  const storedSort = useAppStore((state) => state.preferences.listSort?.[listKey]);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const showToast = useAppStore((state) => state.showToast);
  const field = storedSort?.field || defaultField;
  const direction = validDirection(storedSort?.direction || defaultDirection);

  const setField = (nextField) => {
    void setPreferences({ listSort: { [listKey]: { field: nextField, direction: 'asc' } } })
      .catch(() => showToast('Sort preference could not be saved', 'danger'));
  };
  const toggleDirection = () => {
    void setPreferences({ listSort: { [listKey]: { field, direction: direction === 'asc' ? 'desc' : 'asc' } } })
      .catch(() => showToast('Sort preference could not be saved', 'danger'));
  };

  return { field, direction, setField, toggleDirection };
}
