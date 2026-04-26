import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats enum-ish status strings for UI pills:
 *   'past_due'  → 'PAST DUE'
 *   'paid'      → 'PAID'
 *   'overdue'   → 'OVERDUE'
 *   null        → ''
 *
 * Centralises the "UPPERCASE + underscore→space" transform so every
 * status tag across payments/profile/onboarding renders identically.
 * Keep logic minimal — this is a formatting pipe, not a translation
 * layer; multi-word labels (e.g. "Paid out of band") are passed through
 * to uppercase unchanged.
 */
@Pipe({
  name: 'statusLabel',
  standalone: true,
})
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(/_/g, ' ').toUpperCase();
  }
}
