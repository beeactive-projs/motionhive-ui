import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  OnInit,
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
export class CreateSubscriptionDialog implements OnInit {
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

  private readonly _syncFormEffect = effect(() => {
    if (this.visible()) {
      this.formClientUserId = undefined;
      this.formProductId = undefined;
      this.formTrialDays = undefined;
      this.selectedProduct.set(null);
    }
  });

  ngOnInit(): void {
    this.loadClients();
    this.loadProducts();
  }

  private loadClients(): void {
    this._clientService.getClients({ status: 'ACTIVE', limit: 999 }).subscribe({
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
      .list({ type: ProductTypes.Subscription, isActive: true, limit: 999 })
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
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.saved.emit();
          this._messageService.add({
            severity: 'success',
            summary: 'Subscription created',
            detail: 'The subscription has been created successfully',
          });
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to create subscription',
          });
        },
      });
  }
}
