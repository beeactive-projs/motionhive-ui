import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { DatePicker } from 'primeng/datepicker';
import { Checkbox } from 'primeng/checkbox';
import {
  InvoiceService as PaymentInvoiceService,
  ClientService,
  ProductService,
  ProductTypes,
  type InstructorClient,
  type Product,
} from 'core';

interface ClientOption {
  label: string;
  value: string;
  email: string;
}

interface ProductOption {
  label: string;
  value: string;
  product: Product;
}

@Component({
  selector: 'mh-create-invoice-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    InputNumber,
    Select,
    TextareaModule,
    DatePicker,
    Checkbox,
  ],
  templateUrl: './create-invoice-dialog.html',
  styleUrl: './create-invoice-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateInvoiceDialog {
  private readonly _invoiceService = inject(PaymentInvoiceService);
  private readonly _clientService = inject(ClientService);
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);
  private readonly _fb = inject(FormBuilder);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly clientOptions = signal<ClientOption[]>([]);
  readonly clientsLoading = signal(false);
  readonly productOptions = signal<ProductOption[]>([]);
  readonly useManualEmail = signal(false);

  readonly form = this._fb.group({
    clientUserId: [''],
    guestEmail: ['', [Validators.email]],
    guestFirstName: [''],
    guestLastName: [''],
    notes: [''],
    dueDate: [null as Date | null],
    sendImmediately: [false],
    lineItems: this._fb.array([this.createLineItemGroup()]),
  });

  get lineItems(): FormArray {
    return this.form.get('lineItems') as FormArray;
  }

  private _clientsLoaded = false;
  private _productsLoaded = false;
  private _wasVisible = false;

  private readonly _resetOnOpenEffect = effect(() => {
    const visible = this.visible();
    if (visible && !this._wasVisible) {
      this.form.reset({ sendImmediately: false, quantity: 1 } as never);
      this.lineItems.clear();
      this.lineItems.push(this.createLineItemGroup());
      this.useManualEmail.set(false);
      if (!this._clientsLoaded) this.loadClients();
      if (!this._productsLoaded) this.loadProducts();
    }
    this._wasVisible = visible;
  });

  onRecipientModeChange(manual: boolean): void {
    this.useManualEmail.set(manual);
    if (manual) {
      this.form.patchValue({ clientUserId: '' });
    } else {
      this.form.patchValue({ guestEmail: '', guestFirstName: '', guestLastName: '' });
    }
  }

  createLineItemGroup(): FormGroup {
    return this._fb.group({
      productId: [null as string | null],
      name: ['', [Validators.required]],
      description: [''],
      amount: [null as number | null, [Validators.required, Validators.min(0.5)]],
      quantity: [1 as number | null, [Validators.required, Validators.min(1)]],
    });
  }

  addLineItem(): void {
    this.lineItems.push(this.createLineItemGroup());
  }

  removeLineItem(index: number): void {
    if (this.lineItems.length > 1) {
      this.lineItems.removeAt(index);
    }
  }

  private readonly _formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  readonly totalCents = computed(() => {
    this._formValue();
    return this.lineItems.controls.reduce((sum, control) => {
      const amount = (control.get('amount')?.value as number) ?? 0;
      const qty = (control.get('quantity')?.value as number) ?? 1;
      return sum + Math.round(amount * 100) * (qty || 1);
    }, 0);
  });

  onAmountInput(index: number, event: { value: number | null }): void {
    const ctrl = this.lineItems.at(index).get('amount');
    ctrl?.setValue(event.value, { emitEvent: true });
    ctrl?.markAsDirty();
    ctrl?.updateValueAndValidity();
  }

  onQuantityChange(index: number, value: number | null): void {
    const next = Math.max(1, Math.floor(value ?? 1));
    const ctrl = this.lineItems.at(index).get('quantity');
    ctrl?.setValue(next, { emitEvent: true });
    ctrl?.markAsDirty();
    ctrl?.updateValueAndValidity();
  }

  incQuantity(index: number): void {
    const current = (this.lineItems.at(index).get('quantity')?.value as number) ?? 1;
    this.onQuantityChange(index, current + 1);
  }

  decQuantity(index: number): void {
    const current = (this.lineItems.at(index).get('quantity')?.value as number) ?? 1;
    this.onQuantityChange(index, current - 1);
  }

  onProductSelect(index: number, productId: string | null): void {
    const group = this.lineItems.at(index);
    group.get('productId')?.setValue(productId);
    if (!productId) return;
    const opt = this.productOptions().find((o) => o.value === productId);
    if (!opt) return;
    group.patchValue({
      name: opt.product.name,
      description: opt.product.description ?? '',
      amount: opt.product.amountCents / 100,
    });
    group.get('name')?.updateValueAndValidity();
    group.get('description')?.updateValueAndValidity();
    group.get('amount')?.updateValueAndValidity();
  }

  lineSubtotalCents(index: number): number {
    this._formValue();
    const control = this.lineItems.at(index);
    const amount = (control?.get('amount')?.value as number) ?? 0;
    const qty = (control?.get('quantity')?.value as number) ?? 1;
    return Math.round(amount * 100) * (qty || 1);
  }

  toggleManualEmail(): void {
    this.useManualEmail.update((v) => !v);
    if (this.useManualEmail()) {
      this.form.patchValue({ clientUserId: '' });
    } else {
      this.form.patchValue({ guestEmail: '', guestFirstName: '', guestLastName: '' });
    }
  }

  private loadProducts(): void {
    this._productService
      .list({ type: ProductTypes.OneOff, isActive: true, limit: 100 })
      .subscribe({
        next: (response) => {
          this.productOptions.set(
            response.items.map((p) => ({
              label: `${p.name} — ${(p.amountCents / 100).toFixed(2)} RON`,
              value: p.id,
              product: p,
            })),
          );
          this._productsLoaded = true;
        },
        error: () => {
          this._productsLoaded = true;
        },
      });
  }

  addLineItemFromProduct(productId: string): void {
    const group = this.createLineItemGroup();
    this.lineItems.push(group);
    queueMicrotask(() => this.onProductSelect(this.lineItems.length - 1, productId));
  }

  private loadClients(): void {
    this.clientsLoading.set(true);
    this._clientService.getClients({ status: 'ACTIVE', limit: 100 }).subscribe({
      next: (response) => {
        this.clientOptions.set(
          response.items
            .filter((c: InstructorClient) => c.client)
            .map((c: InstructorClient) => ({
              label: `${c.client!.firstName} ${c.client!.lastName}`,
              value: c.clientId,
              email: c.client!.email,
            })),
        );
        this._clientsLoaded = true;
        this.clientsLoading.set(false);
      },
      error: () => {
        this.clientsLoading.set(false);
      },
    });
  }

  submit(): void {
    this.form.markAllAsTouched();

    if (this.useManualEmail()) {
      const email = this.form.value.guestEmail?.trim();
      const firstName = this.form.value.guestFirstName?.trim();
      if (!email || this.form.get('guestEmail')?.invalid) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Email required',
          detail: 'Please enter a valid email address for the recipient.',
        });
        return;
      }
      if (!firstName) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Name required',
          detail: 'Please enter at least a first name for the recipient.',
        });
        return;
      }
    } else if (!this.form.value.clientUserId) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Client required',
        detail: 'Please select a client or enter an email address.',
      });
      return;
    }

    if (this.lineItems.invalid) {
      const details: string[] = [];
      this.lineItems.controls.forEach((group, idx) => {
        const name = group.get('name');
        const amt = group.get('amount');
        const qty = group.get('quantity');
        if (name?.invalid) details.push(`Line ${idx + 1}: name required`);
        if (amt?.invalid) details.push(`Line ${idx + 1}: amount must be ≥ 0.50 RON`);
        if (qty?.invalid) details.push(`Line ${idx + 1}: quantity must be ≥ 1`);
      });
      this._messageService.add({
        severity: 'warn',
        summary: 'Line items invalid',
        detail: details.join(' · ') || 'Check all line items',
      });
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();
    const lineItems = raw.lineItems.map((li: Record<string, unknown>) => {
      const name = ((li['name'] as string) || '').trim();
      const desc = ((li['description'] as string) || '').trim();
      const combined = desc ? `${name} — ${desc}` : name;
      return {
        description: combined.slice(0, 255),
        amountCents: Math.round(((li['amount'] as number) ?? 0) * 100),
        quantity: ((li['quantity'] as number | null) ?? 1) || 1,
      };
    });

    const payload: Record<string, unknown> = {
      lineItems,
      description: raw.notes?.trim() || undefined,
      sendImmediately: raw.sendImmediately ?? false,
    };

    if (raw.dueDate) {
      payload['dueDate'] = (raw.dueDate as Date).toISOString().split('T')[0];
    }

    if (this.useManualEmail()) {
      payload['guestEmail'] = raw.guestEmail!.trim();
      const firstName = raw.guestFirstName?.trim() ?? '';
      const lastName = raw.guestLastName?.trim() ?? '';
      const guestName = `${firstName} ${lastName}`.trim();
      if (guestName) {
        payload['guestName'] = guestName;
      }
    } else {
      payload['clientUserId'] = raw.clientUserId;
    }

    this._invoiceService.create(payload as never).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit();
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice created',
          detail: raw.sendImmediately ? 'Invoice created and sent' : 'Invoice created as draft',
        });
      },
      error: (err) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to create invoice',
        });
      },
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }
}
