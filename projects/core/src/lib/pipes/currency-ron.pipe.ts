import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyRon',
  standalone: true,
})
export class CurrencyRonPipe implements PipeTransform {
  /**
   * `display: 'code'` forces the three-letter code instead of a symbol.
   *
   * A client can hold invoices from coaches who settle in different
   * currencies, and "€250" beside "250 lei" invites reading them as one
   * number. The code makes the difference unmissable, which is why nothing in
   * this app ever sums across currencies.
   */
  transform(
    amountCents: number | null | undefined,
    currency = 'RON',
    display: 'symbol' | 'code' = 'symbol',
  ): string {
    if (amountCents == null || Number.isNaN(amountCents)) {
      return '';
    }
    const amount = amountCents / 100;
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: display,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
