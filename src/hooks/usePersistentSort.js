import useAppStore from '../store/useAppStore';

const validDirection = (direction) => (direction === 'desc' ? 'desc' : 'asc');

export default function usePersistentSort(listKey, defaultField, defaultDirection = 'asc') {
  const storedSort = useAppStore((state) => state.preferences.listSort?.[listKey]);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const field = storedSort?.field || defaultField;
  const direction = validDirection(storedSort?.direction || defaultDirection);

  const setField = (nextField) => setPreferences({
    listSort: { [listKey]: { field: nextField, direction: 'asc' } },
  });
  const toggleDirection = () => setPreferences({
    listSort: { [listKey]: { field, direction: direction === 'asc' ? 'desc' : 'asc' } },
  });

  return { field, direction, setField, toggleDirection };
}
