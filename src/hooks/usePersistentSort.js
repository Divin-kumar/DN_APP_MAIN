import usePersistentListState from './usePersistentListState';

export default function usePersistentSort(listKey, defaultField, defaultDirection = 'asc') {
  const [{ field, direction }, change] = usePersistentListState(`sort:${listKey}`,
    { field: defaultField, direction: defaultDirection }, { direction: ['asc', 'desc'] });
  const setField = (nextField) => change({ field: nextField, direction: 'asc' });
  const toggleDirection = () => change((current) => ({ direction: current.direction === 'asc' ? 'desc' : 'asc' }));

  return { field, direction, setField, toggleDirection };
}
