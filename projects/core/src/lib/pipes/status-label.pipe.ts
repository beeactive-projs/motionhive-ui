import { Pipe, PipeTransform } from '@angular/core';

import { appLocale } from '../i18n/app-language';
import { enumLabel } from '../i18n/enum-label';

/**
 * Formats enum-ish status strings for UI pills, uppercased:
 *
 *   status | statusLabel: 'invoiceStatus'   → enum.invoiceStatus.<VALUE>, e.g. 'PAID' / 'PLĂTITĂ'
 *   'past_due' | statusLabel                → 'PAST DUE' (no domain: raw value, untranslated)
 *   null                                    → ''
 *
 * Centralises the uppercase pill style so every status tag across
 * payments/profile/onboarding renders identically. Pass the enum domain so
 * the word is translated; the domain-less form exists only for values with no
 * `enum.*` keys yet.
 */
@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, domain?: string): string {
    if (!value) return '';
    const label = domain ? enumLabel(domain, value) : value.replace(/_/g, ' ');
    return label.toLocaleUpperCase(appLocale());
  }
}
