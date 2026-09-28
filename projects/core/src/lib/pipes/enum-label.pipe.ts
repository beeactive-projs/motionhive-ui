import { Pipe, PipeTransform } from '@angular/core';

import { enumLabel } from '../i18n/enum-label';

/**
 * Display label for an enum value, from the shared `enum.<domain>.<VALUE>` keys:
 *
 *   {{ invoice.status | enumLabel: 'invoiceStatus' }}   → "Past due" / "Restanță"
 *
 * Pure — the UI language is fixed for the page load.
 */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, domain: string): string {
    return enumLabel(domain, value);
  }
}
