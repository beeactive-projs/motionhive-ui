import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyRon',
  standalone: true,
})
export class CurrencyRonPipe implements PipeTransform {
  transform(amountCents: number | null | undefined, currency = 'RON'): string {
    if (amountCents == null || Number.isNaN(amountCents)) {
      return '';
    }
    const amount = amountCents / 100;
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
