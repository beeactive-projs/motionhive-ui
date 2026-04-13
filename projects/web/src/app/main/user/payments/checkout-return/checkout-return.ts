import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ClientPaymentService, InvoiceStatuses, type Invoice } from 'core';

@Component({
  selector: 'mh-checkout-return',
  imports: [ButtonModule, CardModule, ProgressSpinnerModule],
  templateUrl: './checkout-return.html',
  styleUrl: './checkout-return.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutReturn implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _clientPaymentService = inject(ClientPaymentService);

  readonly state = signal<'loading' | 'paid' | 'pending' | 'error'>('loading');
  readonly invoice = signal<Invoice | null>(null);

  private pollCount = 0;
  private readonly maxPolls = 8;

  ngOnInit(): void {
    const invoiceId = this._route.snapshot.queryParamMap.get('invoiceId');
    if (!invoiceId) {
      this.state.set('error');
      return;
    }
    this.pollInvoice(invoiceId);
  }

  private pollInvoice(invoiceId: string): void {
    this._clientPaymentService.getMyInvoice(invoiceId).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        if (inv.status === InvoiceStatuses.Paid) {
          this.state.set('paid');
          return;
        }
        this.pollCount++;
        if (this.pollCount >= this.maxPolls) {
          this.state.set('pending');
          return;
        }
        setTimeout(() => this.pollInvoice(invoiceId), 1500);
      },
      error: () => {
        this.state.set('error');
      },
    });
  }

  goToInvoices(): void {
    this._router.navigate(['/user/invoices']);
  }
}
