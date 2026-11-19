import { TableLazyLoadEvent } from 'primeng/table';

/**
 * The table event to send, with the chip the coach picked as one of its
 * filters. PrimeNG's own page and sort events carry no chip, so without this
 * page 2 of "Archived" listed every client while the chip still read Archived.
 * No chip means no filter on that field, never an empty one.
 */
export function withChipFilter(
  event: TableLazyLoadEvent,
  field: string,
  value: string | undefined,
  matchMode?: string,
): TableLazyLoadEvent {
  const filters = { ...(event.filters ?? {}) };
  delete filters[field];
  if (value) {
    if (matchMode) {
      filters[field] = { value, matchMode };
    } else {
      filters[field] = { value };
    }
  }
  return { ...event, filters };
}
