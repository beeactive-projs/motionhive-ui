import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  ClientPaymentService,
  InvoiceStatuses,
  ConsentTypes,
  TagSeverity,
  CurrencyRonPipe,
  StripeIframeDirective,
  type Invoice,
  type InvoiceStatus,
} from 'core';

@Component({
  selector: 'mh-user-invoice-detail',
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ButtonModule,
    CardModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    CheckboxModule,
    CurrencyRonPipe,
    StripeIframeDirective,
  ],
  providers: [MessageService],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserInvoiceDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _clientPaymentService = inject(ClientPaymentService);
  private readonly _messageService = inject(MessageService);

  readonly invoice = signal<Invoice | null>(null);
  readonly loading = signal(true);
  readonly payLoading = signal(false);

  consentChecked = false;

  readonly consentText =
    'Sunt de acord cu accesul imediat la serviciu și renunț la dreptul meu de retragere de 14 zile / I agree to immediate access and waive my 14-day withdrawal right.';

  readonly Statuses = InvoiceStatuses;

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/invoices']);
      return;
    }
    this.loadInvoice(id);
  }

  private loadInvoice(id: string): void {
    this.loading.set(true);
    this._clientPaymentService.getMyInvoice(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Invoice not found',
        });
        this._router.navigate(['/user/invoices']);
      },
    });
  }

  payInvoice(): void {
    const inv = this.invoice();
    if (!inv || !this.consentChecked) return;

    this.payLoading.set(true);
    this._clientPaymentService
      .payInvoice(inv.id, {
        consentType: ConsentTypes.ImmediateAccessWaiver,
        consentText: this.consentText,
      })
      .subscribe({
        next: (res) => {
          window.location.href = res.checkoutUrl;
        },
        error: (err) => {
          this.payLoading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to start payment',
          });
        },
      });
  }

  statusSeverity(status: InvoiceStatus): TagSeverity {
    switch (status) {
      case InvoiceStatuses.Paid:
        return TagSeverity.Success;
      case InvoiceStatuses.Open:
        return TagSeverity.Warn;
      case InvoiceStatuses.Void:
      case InvoiceStatuses.Uncollectible:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  }
}
