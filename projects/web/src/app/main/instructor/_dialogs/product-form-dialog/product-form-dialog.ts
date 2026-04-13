import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Message } from 'primeng/message';
import {
  ProductService,
  ProductTypes,
  BillingIntervals,
  type Product,
  type ProductType,
  type BillingInterval,
} from 'core';

@Component({
  selector: 'mh-product-form-dialog',
  imports: [
    FormsModule,
    Button,
    Dialog,
    InputText,
    InputNumber,
    Select,
    TextareaModule,
    ToggleSwitch,
    Message,
  ],
  templateUrl: './product-form-dialog.html',
  styleUrl: './product-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormDialog {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly product = input<Product | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);

  // Form fields
  formName = '';
  formDescription = '';
  formType: ProductType = ProductTypes.OneOff;
  formAmountCents = 0;
  formInterval: BillingInterval = BillingIntervals.Month;
  formIntervalCount = 1;
  formIsActive = true;

  readonly typeOptions = [
    { label: 'One-off', value: ProductTypes.OneOff },
    { label: 'Subscription', value: ProductTypes.Subscription },
  ];

  readonly intervalOptions = [
    { label: 'Day', value: BillingIntervals.Day },
    { label: 'Week', value: BillingIntervals.Week },
    { label: 'Month', value: BillingIntervals.Month },
    { label: 'Year', value: BillingIntervals.Year },
  ];

  get isEditing(): boolean {
    return this.product() !== null;
  }

  get dialogHeader(): string {
    return this.isEditing ? 'Edit product' : 'Create product';
  }

  get isSubscription(): boolean {
    return this.formType === ProductTypes.Subscription;
  }

  private readonly _syncFormEffect = effect(() => {
    if (this.visible()) {
      const p = this.product();
      if (p) {
        this.formName = p.name;
        this.formDescription = p.description ?? '';
        this.formType = p.type;
        this.formAmountCents = p.amountCents / 100;
        this.formInterval = p.interval ?? BillingIntervals.Month;
        this.formIntervalCount = p.intervalCount ?? 1;
        this.formIsActive = p.isActive;
      } else {
        this.formName = '';
        this.formDescription = '';
        this.formType = ProductTypes.OneOff;
        this.formAmountCents = 0;
        this.formInterval = BillingIntervals.Month;
        this.formIntervalCount = 1;
        this.formIsActive = true;
      }
    }
  });

  save(): void {
    if (!this.formName.trim()) return;
    if (!this.isEditing && this.formAmountCents <= 0) return;

    this.saving.set(true);
    const p = this.product();

    if (p) {
      this._productService
        .update(p.id, {
          name: this.formName.trim(),
          description: this.formDescription.trim() || undefined,
          isActive: this.formIsActive,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.visible.set(false);
            this.saved.emit();
            this._messageService.add({
              severity: 'success',
              summary: 'Product updated',
              detail: `"${this.formName}" has been updated`,
            });
          },
          error: (err) => {
            this.saving.set(false);
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to update product',
            });
          },
        });
    } else {
      this._productService
        .create({
          name: this.formName.trim(),
          description: this.formDescription.trim() || undefined,
          type: this.formType,
          amountCents: Math.round(this.formAmountCents * 100),
          ...(this.isSubscription && {
            interval: this.formInterval,
            intervalCount: this.formIntervalCount,
          }),
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.visible.set(false);
            this.saved.emit();
            this._messageService.add({
              severity: 'success',
              summary: 'Product created',
              detail: `"${this.formName}" has been created`,
            });
          },
          error: (err) => {
            this.saving.set(false);
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to create product',
            });
          },
        });
    }
  }
}
