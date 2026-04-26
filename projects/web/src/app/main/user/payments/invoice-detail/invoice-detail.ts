import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  ClientPaymentService,
  InvoiceStatuses,
  CurrencyRonPipe,
  StatusLabelPipe,
  getInvoiceStatusSeverity,
  type Invoice,
  type InvoiceLineItemDetail,
} from 'core';

/**
 * One step in the invoice lifecycle tracker. Mirrors the instructor-side
 * page so the client sees the same visual story: Draft → Sent → Paid.
 */
interface TrackerStep {
  key: 'draft' | 'sent' | 'paid';
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'pending';
}

interface ActivityEntry {
  label: string;
  at: string;
  kind: 'neutral' | 'success' | 'warn' | 'danger';
}

@Component({
  selector: 'mh-user-invoice-detail',
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    CheckboxModule,
    CurrencyRonPipe,
    StatusLabelPipe,
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
  readonly lineItems = signal<InvoiceLineItemDetail[]>([]);
  readonly lineItemsLoading = signal(false);
  readonly loading = signal(true);
  readonly payLoading = signal(false);

  consentChecked = false;

  readonly Statuses = InvoiceStatuses;

  /** Waiver text shown to the client — picks RO or EN based on the
   *  browser's preferred language. The canonical bilingual text is saved
   *  server-side regardless of which version we show here (legal audit
   *  must cover both jurisdictions). */
  readonly consentText = this.resolveWaiverText();

  /** Display label for the hero (e.g. "MH-0001" or "#AB12CD34"). */
  readonly displayNumber = computed(() => {
    const inv = this.invoice();
    if (!inv) return '';
    return inv.number ?? `#${inv.id.slice(0, 8).toUpperCase()}`;
  });

  /**
   * 3-step lifecycle tracker. No "viewed" step — emailed invoices can't
   * be reliably tracked as viewed. Identical logic to the instructor
   * page so both sides tell the same story.
   */
  readonly tracker = computed<TrackerStep[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];

    const draft: TrackerStep = {
      key: 'draft',
      label: 'Draft',
      date: inv.createdAt,
      state: 'done',
    };
    const sent: TrackerStep = {
      key: 'sent',
      label: 'Sent',
      date: inv.finalizedAt,
      state: inv.finalizedAt ? 'done' : 'pending',
    };
    const paid: TrackerStep = {
      key: 'paid',
      label: 'Paid',
      date: inv.paidAt,
      state: inv.paidAt ? 'done' : 'pending',
    };

    if (sent.state === 'pending') {
      sent.state = 'current';
    } else if (paid.state === 'pending') {
      paid.state = 'current';
    }

    return [draft, sent, paid];
  });

  /** Activity log derived from timestamps — same ordering as the
   *  instructor page (newest first). */
  readonly activity = computed<ActivityEntry[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const events: ActivityEntry[] = [
      { label: 'Invoice issued', at: inv.createdAt, kind: 'neutral' },
    ];
    if (inv.finalizedAt) {
      events.push({ label: 'Invoice sent', at: inv.finalizedAt, kind: 'neutral' });
    }
    if (inv.paidAt) {
      events.push({ label: 'Invoice paid', at: inv.paidAt, kind: 'success' });
    }
    if (inv.voidedAt) {
      events.push({ label: 'Invoice voided', at: inv.voidedAt, kind: 'danger' });
    }
    return events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/invoices']);
      return;
    }
    this.loadInvoice(id);
    this.loadLineItems(id);
  }

  private resolveWaiverText(): string {
    const lang = (
      typeof navigator !== 'undefined' ? navigator.language : 'en'
    ).toLowerCase();
    if (lang.startsWith('ro')) {
      return 'Sunt de acord cu accesul imediat la serviciu și renunț la dreptul meu de retragere de 14 zile (OUG 34/2014).';
    }
    return 'I agree to immediate access to the service and waive my 14-day right of withdrawal (Romanian OUG 34/2014).';
  }

  private loadLineItems(id: string): void {
    this.lineItemsLoading.set(true);
    this._clientPaymentService.getMyInvoiceLineItems(id).subscribe({
      next: (items) => {
        this.lineItems.set(items);
        this.lineItemsLoading.set(false);
      },
      error: () => {
        this.lineItems.set([]);
        this.lineItemsLoading.set(false);
      },
    });
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
      .payInvoice(inv.id, { immediateAccessWaiverAccepted: true })
      .subscribe({
        next: (res) => {
          window.location.href = res.url;
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

  readonly statusSeverity = getInvoiceStatusSeverity;
}
