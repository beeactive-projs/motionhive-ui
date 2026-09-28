import {
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService, SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
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
  StripeOnboardingStore,
  showApiError,
  type Product,
  type ProductType,
  type BillingInterval,
} from 'core';

@Component({
  selector: 'mh-product-form-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonDirective,
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
})
export class ProductFormDialog {
  private readonly _productService = inject(ProductService);
  private readonly _onboardingStore = inject(StripeOnboardingStore);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly product = input<Product | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);
  /**
   * Currency used purely for display in the price input (uppercase
   * ISO 4217). Derived from the instructor's Stripe account default
   * currency. Falls back to 'USD' when the account isn't loaded yet.
   * The server ignores the client's currency hint on create and
   * always uses the account's settlement currency.
   */
  readonly displayCurrency = signal<string>('USD');

  // Form fields
  formName = '';
  formDescription = '';
  formType: ProductType = ProductTypes.OneOff;
  formAmountCents = 0;
  formInterval: BillingInterval = BillingIntervals.Month;
  formIntervalCount = 1;
  formIsActive = true;
  formShowOnProfile = false;

  readonly typeOptions: SelectItem<ProductType>[] = [ProductTypes.OneOff, ProductTypes.Subscription].map(
    (value) => ({
      label: this._translateService.instant(`paymentDialogs.productForm.type.${value}`),
      value,
    }),
  );

  readonly intervalOptions: SelectItem<BillingInterval>[] = [
    BillingIntervals.Day,
    BillingIntervals.Week,
    BillingIntervals.Month,
    BillingIntervals.Year,
  ].map((value) => ({
    label: this._translateService.instant(`paymentDialogs.interval.option.${value}`),
    value,
  }));

  get isEditing(): boolean {
    return this.product() !== null;
  }

  get dialogHeader(): string {
    return this._translateService.instant(
      this.isEditing ? 'paymentDialogs.productForm.title.edit' : 'paymentDialogs.productForm.title.create',
    );
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
        this.formShowOnProfile = p.showOnProfile;
        // Editing an existing product: its currency is fixed.
        this.displayCurrency.set(p.currency?.toUpperCase() || 'USD');
      } else {
        this.formName = '';
        this.formDescription = '';
        this.formType = ProductTypes.OneOff;
        this.formAmountCents = 0;
        this.formInterval = BillingIntervals.Month;
        this.formIntervalCount = 1;
        this.formIsActive = true;
        this.formShowOnProfile = false;
        // Pull the instructor's default currency from the shared
        // onboarding cache. ensureLoaded() is a no-op once warmed,
        // and the BE picks the real currency from the Stripe account
        // anyway — this is purely the input symbol rendered in the
        // price field.
        this._onboardingStore.ensureLoaded();
        const cur = this._onboardingStore.defaultCurrency();
        this.displayCurrency.set(cur ? cur.toUpperCase() : 'USD');
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
          showOnProfile: this.formShowOnProfile,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.visible.set(false);
            this.saved.emit();
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('paymentDialogs.productForm.toast.updated.summary'),
              detail: this._translateService.instant('paymentDialogs.productForm.toast.updated.detail', {
                name: this.formName,
              }),
            });
          },
          error: (err: unknown) => {
            this.saving.set(false);
            showApiError(
              this._messageService,
              this._translateService.instant('toast.summary.error'),
              this._translateService.instant('paymentDialogs.productForm.toast.updateFailed'),
              err,
            );
          },
        });
    } else {
      this._productService
        .create({
          name: this.formName.trim(),
          description: this.formDescription.trim() || undefined,
          type: this.formType,
          amountCents: Math.round(this.formAmountCents * 100),
          showOnProfile: this.formShowOnProfile,
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
              summary: this._translateService.instant('paymentDialogs.productForm.toast.created.summary'),
              detail: this._translateService.instant('paymentDialogs.productForm.toast.created.detail', {
                name: this.formName,
              }),
            });
          },
          error: (err: unknown) => {
            this.saving.set(false);
            showApiError(
              this._messageService,
              this._translateService.instant('toast.summary.error'),
              this._translateService.instant('paymentDialogs.productForm.toast.createFailed'),
              err,
            );
          },
        });
    }
  }
}
