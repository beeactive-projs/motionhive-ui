import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  ClientService,
  CurrencyRonPipe,
  InstructorClient,
  InvoiceLineItem,
  InvoiceService,
  StripeOnboardingService,
  displayName,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { PAYMENT_ICONS } from '../../payments.config';

interface DraftItem {
  description: string;
  amount: string;
  quantity: number;
}

/**
 * Billing a client from a phone (4e).
 *
 * This belongs on mobile because "invoice them right after the session" is a
 * phone moment — the coach is standing in the gym, not at a desk. It is
 * deliberately thinner than the web form: one currency, plain line items, no
 * tax or discounts. Anything more complicated is a desk job.
 *
 * Currency is shown but not editable. It is the coach's Stripe settlement
 * currency, and offering a picker would imply a choice the account does not
 * have.
 */
@Component({
  selector: 'mh-create-invoice',
  imports: [
    CurrencyRonPipe,
    FormsModule,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    SheetShell,
  ],
  templateUrl: './create-invoice.html',
  styleUrl: './create-invoice.scss',
})
export class CreateInvoice implements ViewWillEnter {
  private readonly _clientService = inject(ClientService);
  private readonly _invoiceService = inject(InvoiceService);
  private readonly _onboardingService = inject(StripeOnboardingService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  readonly clients = signal<InstructorClient[]>([]);
  readonly clientId = signal<string | null>(null);
  readonly pickerOpen = signal(false);

  readonly items = signal<DraftItem[]>([{ description: '', amount: '', quantity: 1 }]);
  readonly dueDate = signal<string>('');
  readonly currency = signal('RON');
  readonly saving = signal(false);

  readonly selectedClient = computed(() =>
    this.clients().find((client) => client.clientId === this.clientId()) ?? null,
  );

  readonly selectedName = computed(() =>
    this.selectedClient() ? this.nameOf(this.selectedClient()!) : '',
  );

  /** Cents, so the total never drifts through floating point. */
  readonly totalCents = computed(() =>
    this.items().reduce((sum, item) => {
      const amount = Math.round(Number.parseFloat(item.amount || '0') * 100);
      if (Number.isNaN(amount)) return sum;
      return sum + amount * Math.max(1, item.quantity);
    }, 0),
  );

  readonly canSave = computed(
    () =>
      !!this.clientId() &&
      this.totalCents() > 0 &&
      this.items().some((item) => item.description.trim().length > 0),
  );

  constructor() {
    addIcons(PAYMENT_ICONS);
  }

  ionViewWillEnter(): void {
    this._loadClients();
    this._loadCurrency();
  }

  nameOf(client: InstructorClient): string {
    return displayName(client.client ?? null, client.client?.email ?? 'Client');
  }

  toneFor(client: InstructorClient): string {
    return avatarToneFor(client.clientId);
  }

  pick(client: InstructorClient): void {
    this.clientId.set(client.clientId);
    this.pickerOpen.set(false);
  }

  addItem(): void {
    this.items.update((items) => [...items, { description: '', amount: '', quantity: 1 }]);
  }

  removeItem(index: number): void {
    this.items.update((items) => items.filter((_, i) => i !== index));
  }

  setDescription(index: number, value: string): void {
    this.items.update((items) =>
      items.map((item, i) => (i === index ? { ...item, description: value } : item)),
    );
  }

  setAmount(index: number, value: string): void {
    this.items.update((items) =>
      items.map((item, i) => (i === index ? { ...item, amount: value } : item)),
    );
  }

  step(index: number, by: number): void {
    this.items.update((items) =>
      items.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, item.quantity + by) } : item,
      ),
    );
  }

  /** Draft or send is one decision, made here rather than by a hidden toggle. */
  save(sendImmediately: boolean): void {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);

    const lineItems: InvoiceLineItem[] = this.items()
      .filter((item) => item.description.trim() && Number.parseFloat(item.amount || '0') > 0)
      .map((item) => ({
        description: item.description.trim(),
        amountCents: Math.round(Number.parseFloat(item.amount) * 100),
        quantity: Math.max(1, item.quantity),
      }));

    this._invoiceService
      .create({
        clientUserId: this.clientId()!,
        lineItems,
        ...(this.dueDate() ? { dueDate: this.dueDate() } : {}),
        sendImmediately,
      })
      .pipe(take(1))
      .subscribe({
        next: (invoice) => {
          this.saving.set(false);
          void this._feedbackService.success(
            sendImmediately ? 'Invoice sent' : 'Draft saved',
          );
          void this._router.navigate(['/tabs/home/payments', invoice.id], {
            replaceUrl: true,
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not create the invoice.');
        },
      });
  }

  private _loadClients(): void {
    this._clientService
      .getClients({ status: 'ACTIVE', page: 1, limit: 100 })
      .pipe(take(1))
      .subscribe({ next: (response) => this.clients.set(response.items ?? []) });
  }

  /** Shown, never chosen — Stripe settles this account in one currency. */
  private _loadCurrency(): void {
    this._onboardingService
      .getStatus()
      .pipe(take(1))
      .subscribe({
        next: ({ account }) => {
          if (account?.defaultCurrency) {
            this.currency.set(account.defaultCurrency.toUpperCase());
          }
        },
      });
  }
}
