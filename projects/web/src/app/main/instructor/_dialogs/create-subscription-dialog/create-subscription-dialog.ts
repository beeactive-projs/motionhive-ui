import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import {
  SubscriptionService,
  ProductService,
  ClientService,
  ProductTypes,
  CurrencyRonPipe,
  showApiError,
  type Product,
  type InstructorClient,
} from 'core';

interface ClientOption {
  label: string;
  value: string;
}

interface ProductOption {
  label: string;
  value: string;
  product: Product;
}

@Component({
  selector: 'mh-create-subscription-dialog',
  imports: [FormsModule, Button, Dialog, Select, InputNumber, CurrencyRonPipe],
  templateUrl: './create-subscription-dialog.html',
  styleUrl: './create-subscription-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSubscriptionDialog {
  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _productService = inject(ProductService);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly clientOptions = signal<ClientOption[]>([]);
  readonly productOptions = signal<ProductOption[]>([]);

  formClientUserId: string | undefined = undefined;
  formProductId: string | undefined = undefined;
  formTrialDays: number | undefined = undefined;

  selectedProduct = signal<Product | null>(null);

  /**
   * Reset the form AND refresh the client/product lists every time
   * the dialog opens. Reloading on open (rather than once on init)
   * means newly added clients or pricing plans appear without a hard
   * page reload.
   */
  private readonly _syncFormEffect = effect(() => {
    if (this.visible()) {
      this.formClientUserId = undefined;
      this.formProductId = undefined;
      this.formTrialDays = undefined;
      this.selectedProduct.set(null);
      this.loadClients();
      this.loadProducts();
    }
  });

  private loadClients(): void {
    this._clientService.getClients({ status: 'ACTIVE', limit: 100 }).subscribe({
      next: (res) => {
        this.clientOptions.set(
          res.items
            .filter((ic: InstructorClient) => !!ic.client)
            .map((ic: InstructorClient) => ({
              label: `${ic.client!.firstName} ${ic.client!.lastName} (${ic.client!.email})`,
              value: ic.clientId,
            })),
        );
      },
    });
  }

  private loadProducts(): void {
    this._productService
      .list({ type: ProductTypes.Subscription, isActive: true, limit: 100 })
      .subscribe({
        next: (res) => {
          this.productOptions.set(
            res.items.map((p) => ({
              label: `${p.name} — ${(p.amountCents / 100).toFixed(2)} ${p.currency}/${p.interval}`,
              value: p.id,
              product: p,
            })),
          );
        },
      });
  }

  onProductChange(productId: string): void {
    const opt = this.productOptions().find((o) => o.value === productId);
    this.selectedProduct.set(opt?.product ?? null);
  }

  submit(): void {
    if (!this.formClientUserId || !this.formProductId) return;

    this.saving.set(true);
    this._subscriptionService
      .create({
        clientUserId: this.formClientUserId,
        productId: this.formProductId,
        trialDays: this.formTrialDays,
      })
      .subscribe({
        next: (sub) => {
          this.saving.set(false);
          this.visible.set(false);
          this.saved.emit();
          // Push-model setup: when the client has no card on file the
          // backend returns the subscription in INCOMPLETE state plus a
          // hosted setup URL. Surface it in the success toast so the
          // instructor sees right away that the client needs to act,
          // and can copy/share the link without diving into the detail
          // page.
          if (sub.pendingConfirmationUrl) {
            this._messageService.add({
              severity: 'info',
              summary: 'Membership pending client confirmation',
              detail:
                "We emailed the client a link to confirm and start their membership. They'll see the plan, amount, and cycle, then pay with a saved or new card. Nothing is charged until they confirm.",
              life: 9000,
            });
          } else {
            this._messageService.add({
              severity: 'success',
              summary: 'Subscription created',
              detail: 'The subscription has been created successfully',
            });
          }
        },
        error: (err: unknown) => {
          this.saving.set(false);
          showApiError(
            this._messageService,
            'Could not create subscription',
            'Please try again.',
            err,
          );
        },
      });
  }
}
