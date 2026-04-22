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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { debounceTime, Subject, Subscription, startWith } from 'rxjs';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import {
  ClientService,
  CurrencyRonPipe,
  InvoiceService as PaymentInvoiceService,
  ProductService,
  ProductTypes,
  type InstructorClient,
  type Product,
} from 'core';

interface ClientOption {
  label: string;
  value: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ProductOption {
  label: string;
  value: string;
  product: Product;
}

/**
 * Due-date presets. The value is "days from issue date".
 * "custom" keeps a picker open so the instructor can set any date.
 */
type DuePreset = 0 | 7 | 14 | 30 | 'custom';

const DRAFT_STORAGE_KEY = 'mh.invoice.draft';
const DRAFT_SAVE_DEBOUNCE_MS = 500;

interface StoredLineItem {
  productId: string | null;
  name: string;
  description: string;
  amount: number | null;
  quantity: number | null;
}

interface StoredDraft {
  clientUserId: string;
  useManualEmail: boolean;
  guestEmail: string;
  guestFirstName: string;
  guestLastName: string;
  notes: string;
  duePreset: DuePreset;
  customDueDate: string | null;
  sendImmediately: boolean;
  lineItems: StoredLineItem[];
  savedAt: string;
}

@Component({
  selector: 'mh-create-invoice-dialog',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    AvatarModule,
    Button,
    Checkbox,
    CurrencyRonPipe,
    DatePicker,
    Dialog,
    InputText,
    InputNumber,
    Select,
    TextareaModule,
    Tooltip,
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
  readonly duePreset = signal<DuePreset>(14);
  readonly draftSavedAt = signal<Date | null>(null);
  readonly today = signal(new Date());

  readonly dueChipOptions: { label: string; value: DuePreset }[] = [
    { label: 'On receipt', value: 0 },
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: 'Custom', value: 'custom' },
  ];

  // NOTE: the following fields are ordered carefully.
  // `form` (below) calls `createLineItemGroup()` during class-field
  // initialization, which writes into `_lineItemSubs`. If we declare
  // `_lineItemSubs` AFTER `form`, it's still undefined when the method
  // runs — we'd crash with `Cannot read properties of undefined`.
  // Keep all helpers/WeakMaps/Subjects ABOVE `form`.

  private _clientsLoaded = false;
  private _productsLoaded = false;
  private _wasVisible = false;
  /** Blocks `persistDraft` from running while a submit is in-flight,
   *  so the debounced auto-save can't revive the draft after we
   *  clear it on success. */
  private _suspendAutoSave = false;
  /** Per-line-item productId.valueChanges subscriptions, keyed by
   *  the FormGroup instance so they're cleaned up when a row is
   *  removed or the whole array is reset. */
  private readonly _lineItemSubs = new WeakMap<FormGroup, Subscription>();
  private readonly _autoSave$ = new Subject<void>();

  readonly form = this._fb.group({
    clientUserId: [''],
    guestEmail: ['', [Validators.email]],
    guestFirstName: [''],
    guestLastName: [''],
    notes: [''],
    customDueDate: [null as Date | null],
    sendImmediately: [true],
    lineItems: this._fb.array([this.createLineItemGroup()]),
  });

  get lineItems(): FormArray {
    return this.form.get('lineItems') as FormArray;
  }

  // `_formValue` depends on `form`, so it MUST be declared below it.
  // `selectedClient` and every other `computed` that touches form state
  // must be declared AFTER `_formValue`.
  private readonly _formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  /** Currently selected client (derived from `clientUserId` + options). */
  readonly selectedClient = computed<ClientOption | null>(() => {
    const id = this._formValue()?.clientUserId;
    if (!id) return null;
    return this.clientOptions().find((c) => c.value === id) ?? null;
  });

  constructor() {
    // Debounced auto-save to localStorage — survives page refresh.
    this._autoSave$
      .pipe(debounceTime(DRAFT_SAVE_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe(() => this.persistDraft());

    // Trigger an auto-save on every form change.
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this._autoSave$.next());
  }

  private readonly _resetOnOpenEffect = effect(() => {
    const visible = this.visible();
    if (visible && !this._wasVisible) {
      this.resetFromDraft();
      if (!this._clientsLoaded) this.loadClients();
      if (!this._productsLoaded) this.loadProducts();
    }
    this._wasVisible = visible;
  });

  // ---------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------

  createLineItemGroup(initial?: Partial<StoredLineItem>): FormGroup {
    const group = this._fb.group({
      productId: [initial?.productId ?? (null as string | null)],
      name: [initial?.name ?? ''],
      description: [initial?.description ?? ''],
      amount: [
        (initial?.amount ?? null) as number | null,
        [Validators.required, Validators.min(0.5)],
      ],
      quantity: [
        (initial?.quantity ?? 1) as number | null,
        [Validators.required, Validators.min(1)],
      ],
    });

    // When the product is picked, pre-fill name/description/amount.
    // We also wire the template `(onChange)` to the same helper as a
    // belt-and-suspenders against PrimeNG timing quirks.
    const sub = group
      .get('productId')!
      .valueChanges.subscribe((productId: string | null) => {
        this.applyProductToGroup(group, productId);
      });
    this._lineItemSubs.set(group, sub);
    return group;
  }

  /**
   * Called from the Select `(onChange)` template handler. Looks up the
   * line item's FormGroup by index and applies the picked product. We
   * pull the group by index (not via the event) because we have the
   * index already in the template's @for loop.
   */
  fillLineFromProduct(index: number, productId: string | null): void {
    const group = this.lineItems.at(index) as FormGroup;
    this.applyProductToGroup(group, productId);
  }

  /** True when the line is linked to a pricing item (i.e. prefilled
   *  from the instructor's catalog). Controls whether fields are
   *  locked and whether the "From pricing" chip shows. */
  isFromPricing(index: number): boolean {
    return !!this.lineItems.at(index).get('productId')?.value;
  }

  /** The ProductOption (if any) linked to the line — used to render
   *  the "From pricing" chip with the product name. */
  linkedProduct(index: number): ProductOption | null {
    const id = this.lineItems.at(index).get('productId')?.value as
      | string
      | null;
    if (!id) return null;
    return this.productOptions().find((o) => o.value === id) ?? null;
  }

  /** Detaches the line from its pricing entry so the user can freely
   *  edit name/description/price. Does NOT clear the already-filled
   *  values — the instructor is likely tweaking them. */
  unlinkPricing(index: number): void {
    const ctrl = this.lineItems.at(index).get('productId');
    ctrl?.setValue(null, { emitEvent: true });
  }

  /**
   * Shared product-fill logic. No-op on null/unknown product id, and
   * no-op if the group's current values already match — that way
   * firing from both the value-changes subscription AND the template
   * `(onChange)` is idempotent and doesn't trigger extra auto-saves.
   *
   * We write each field via its own setValue inside a microtask. This
   * side-steps a PrimeNG `p-inputNumber` display-sync quirk where a
   * batched `patchValue` from inside a sibling control's valueChanges
   * doesn't always propagate to the internal input DOM until the user
   * interacts with it. setValue per-control + a deferred tick forces
   * the CVA writeValue to run cleanly.
   */
  private applyProductToGroup(
    group: FormGroup,
    productId: string | null,
  ): void {
    if (!productId) return;
    const opt = this.productOptions().find((o) => o.value === productId);
    if (!opt) return;

    const nextName = opt.product.name;
    const nextDescription = opt.product.description ?? '';
    const nextAmount = opt.product.amountCents / 100;

    // Defer the writes so the current emit cycle (Select's CVA +
    // productId.valueChanges) completes before we patch siblings.
    // Idempotency is checked INSIDE the microtask so the valueChanges
    // subscription + the template (onChange) handler don't race into
    // double writes — whichever microtask runs second sees the values
    // already applied and bails out.
    queueMicrotask(() => {
      const alreadyApplied =
        group.get('name')?.value === nextName &&
        (group.get('description')?.value ?? '') === nextDescription &&
        group.get('amount')?.value === nextAmount;
      if (alreadyApplied) return;

      group.get('name')?.setValue(nextName, { emitEvent: true });
      group.get('description')?.setValue(nextDescription, { emitEvent: true });
      group.get('amount')?.setValue(nextAmount, { emitEvent: true });
    });
  }

  addLineItem(): void {
    this.lineItems.push(this.createLineItemGroup());
  }

  addLineItemFromProduct(productId: string): void {
    this.lineItems.push(this.createLineItemGroup({ productId }));
  }

  removeLineItem(index: number): void {
    if (this.lineItems.length > 1) {
      const group = this.lineItems.at(index) as FormGroup;
      this._lineItemSubs.get(group)?.unsubscribe();
      this._lineItemSubs.delete(group);
      this.lineItems.removeAt(index);
    }
  }

  onRecipientModeChange(manual: boolean): void {
    this.useManualEmail.set(manual);
    if (manual) {
      this.form.patchValue({ clientUserId: '' });
    } else {
      this.form.patchValue({
        guestEmail: '',
        guestFirstName: '',
        guestLastName: '',
      });
    }
  }

  /** Clear the selected client so the dropdown shows again. */
  clearSelectedClient(): void {
    this.form.patchValue({ clientUserId: '' });
  }

  onDuePresetChange(value: DuePreset): void {
    this.duePreset.set(value);
    if (value !== 'custom') {
      this.form.patchValue({ customDueDate: null });
    }
  }

  readonly subtotalCents = computed(() => {
    this._formValue();
    return this.lineItems.controls.reduce((sum, control) => {
      const amount = (control.get('amount')?.value as number) ?? 0;
      const qty = (control.get('quantity')?.value as number) ?? 1;
      return sum + Math.round(amount * 100) * (qty || 1);
    }, 0);
  });

  /** Alias kept for template clarity — no VAT for now, total === subtotal. */
  readonly totalCents = this.subtotalCents;

  readonly resolvedDueDate = computed<Date | null>(() => {
    const preset = this.duePreset();
    if (preset === 'custom') {
      return this._formValue()?.customDueDate ?? null;
    }
    const days = preset;
    const base = new Date();
    base.setDate(base.getDate() + days);
    base.setHours(0, 0, 0, 0);
    return base;
  });

  lineSubtotalCents(index: number): number {
    this._formValue();
    const control = this.lineItems.at(index);
    const amount = (control?.get('amount')?.value as number) ?? 0;
    const qty = (control?.get('quantity')?.value as number) ?? 1;
    return Math.round(amount * 100) * (qty || 1);
  }

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
    const current =
      (this.lineItems.at(index).get('quantity')?.value as number) ?? 1;
    this.onQuantityChange(index, current + 1);
  }

  decQuantity(index: number): void {
    const current =
      (this.lineItems.at(index).get('quantity')?.value as number) ?? 1;
    this.onQuantityChange(index, current - 1);
  }

  // ---------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------

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
              firstName: c.client!.firstName,
              lastName: c.client!.lastName,
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

  // ---------------------------------------------------------------
  // Draft persistence (localStorage)
  // ---------------------------------------------------------------

  private persistDraft(): void {
    if (this._suspendAutoSave) return;
    try {
      const raw = this.form.getRawValue();
      const draft: StoredDraft = {
        clientUserId: raw.clientUserId ?? '',
        useManualEmail: this.useManualEmail(),
        guestEmail: raw.guestEmail ?? '',
        guestFirstName: raw.guestFirstName ?? '',
        guestLastName: raw.guestLastName ?? '',
        notes: raw.notes ?? '',
        duePreset: this.duePreset(),
        customDueDate: raw.customDueDate
          ? (raw.customDueDate as Date).toISOString()
          : null,
        sendImmediately: raw.sendImmediately ?? false,
        lineItems: raw.lineItems.map((li) => {
          const row = li as Record<string, unknown>;
          return {
            productId: (row['productId'] as string | null) ?? null,
            name: (row['name'] as string) ?? '',
            description: (row['description'] as string) ?? '',
            amount: (row['amount'] as number | null) ?? null,
            quantity: (row['quantity'] as number | null) ?? 1,
          };
        }),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      this.draftSavedAt.set(new Date());
    } catch {
      // localStorage quota or serialization — ignore, non-critical.
    }
  }

  private loadDraft(): StoredDraft | null {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredDraft;
    } catch {
      return null;
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.draftSavedAt.set(null);
  }

  /** Reset form to the stored draft, or to a clean state if none. */
  private resetFromDraft(): void {
    // Unsubscribe every per-line productId subscription before wiping
    // the FormArray so we don't leak observers across resets.
    for (const control of this.lineItems.controls) {
      this._lineItemSubs.get(control as FormGroup)?.unsubscribe();
      this._lineItemSubs.delete(control as FormGroup);
    }
    this.lineItems.clear({ emitEvent: false });

    const draft = this.loadDraft();
    if (draft) {
      this.form.reset(
        {
          clientUserId: draft.clientUserId,
          guestEmail: draft.guestEmail,
          guestFirstName: draft.guestFirstName,
          guestLastName: draft.guestLastName,
          notes: draft.notes,
          customDueDate: draft.customDueDate ? new Date(draft.customDueDate) : null,
          sendImmediately: draft.sendImmediately,
        },
        { emitEvent: false },
      );
      this.useManualEmail.set(draft.useManualEmail);
      this.duePreset.set(draft.duePreset);
      this.draftSavedAt.set(new Date(draft.savedAt));
      const items = draft.lineItems.length > 0 ? draft.lineItems : [{}];
      items.forEach((li) =>
        this.lineItems.push(this.createLineItemGroup(li), { emitEvent: false }),
      );
    } else {
      this.form.reset(
        {
          clientUserId: '',
          guestEmail: '',
          guestFirstName: '',
          guestLastName: '',
          notes: '',
          customDueDate: null,
          sendImmediately: true,
        },
        { emitEvent: false },
      );
      this.useManualEmail.set(false);
      this.duePreset.set(14);
      this.draftSavedAt.set(null);
      this.lineItems.push(this.createLineItemGroup(), { emitEvent: false });
    }
  }

  // ---------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------

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
        const amt = group.get('amount');
        const qty = group.get('quantity');
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

    if (this.duePreset() === 'custom' && !this.form.value.customDueDate) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Due date required',
        detail: 'Pick a date or choose one of the presets.',
      });
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();
    const lineItems = raw.lineItems.map((li: Record<string, unknown>) => {
      const name = ((li['name'] as string) || '').trim();
      const desc = ((li['description'] as string) || '').trim();
      const combined = name && desc ? `${name} — ${desc}` : name || desc || 'Item';
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

    const dueDate = this.resolvedDueDate();
    if (dueDate) {
      payload['dueDate'] = dueDate.toISOString().split('T')[0];
    }

    if (this.useManualEmail()) {
      payload['guestEmail'] = raw.guestEmail!.trim();
      const firstName = raw.guestFirstName?.trim() ?? '';
      const lastName = raw.guestLastName?.trim() ?? '';
      const guestName = `${firstName} ${lastName}`.trim();
      if (guestName) payload['guestName'] = guestName;
    } else {
      payload['clientUserId'] = raw.clientUserId;
    }

    // Suspend auto-save until the request settles: we don't want the
    // debounced write to revive the draft AFTER a successful submit
    // clears it.
    this._suspendAutoSave = true;

    this._invoiceService.create(payload as never).subscribe({
      next: () => {
        this.saving.set(false);
        this.clearDraft();
        this._suspendAutoSave = false;
        this.visible.set(false);
        this.saved.emit();
        this._messageService.add({
          severity: 'success',
          summary: raw.sendImmediately ? 'Invoice sent' : 'Draft saved',
          detail: raw.sendImmediately
            ? 'Invoice created and sent'
            : 'Invoice saved as draft',
        });
      },
      error: (err) => {
        this.saving.set(false);
        this._suspendAutoSave = false;
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to create invoice',
        });
      },
    });
  }

  saveAsDraft(): void {
    // "Save as draft" = send to backend with sendImmediately=false.
    this.form.patchValue({ sendImmediately: false });
    this.submit();
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }
}
