import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
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
  type InstructorClient,
} from 'core';

interface ClientOption {
  label: string;
  value: string;
  email: string;
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
  private readonly _messageService = inject(MessageService);
  private readonly _fb = inject(FormBuilder);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly clientOptions = signal<ClientOption[]>([]);
  readonly clientsLoading = signal(false);
  readonly useManualEmail = signal(false);

  readonly form = this._fb.group({
    clientUserId: [''],
    guestEmail: ['', [Validators.email]],
    guestFirstName: [''],
    guestLastName: [''],
    description: [''],
    dueDate: [null as Date | null],
    sendImmediately: [false],
    lineItems: this._fb.array([this.createLineItemGroup()]),
  });

  get lineItems(): FormArray {
    return this.form.get('lineItems') as FormArray;
  }

  private _clientsLoaded = false;
  private _wasVisible = false;

  private readonly _resetOnOpenEffect = effect(() => {
    const visible = this.visible();
    if (visible && !this._wasVisible) {
      this.form.reset();
      this.lineItems.clear();
      this.lineItems.push(this.createLineItemGroup());
      this.useManualEmail.set(false);
      if (!this._clientsLoaded) {
        this.loadClients();
      }
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
      description: ['', [Validators.required]],
      amountCents: [0, [Validators.required, Validators.min(1)]],
      quantity: [1, [Validators.required, Validators.min(1)]],
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

  get totalCents(): number {
    return this.lineItems.controls.reduce((sum, control) => {
      const amount = control.get('amountCents')?.value ?? 0;
      const qty = control.get('quantity')?.value ?? 1;
      return sum + Math.round(amount * 100) * qty;
    }, 0);
  }

  toggleManualEmail(): void {
    this.useManualEmail.update((v) => !v);
    if (this.useManualEmail()) {
      this.form.patchValue({ clientUserId: '' });
    } else {
      this.form.patchValue({ guestEmail: '', guestFirstName: '', guestLastName: '' });
    }
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

    if (this.form.get('lineItems')?.invalid) return;

    this.saving.set(true);

    const raw = this.form.getRawValue();
    const lineItems = raw.lineItems.map((li: Record<string, unknown>) => ({
      description: li['description'] as string,
      amountCents: Math.round(((li['amountCents'] as number) ?? 0) * 100),
      quantity: (li['quantity'] as number) ?? 1,
    }));

    const payload: Record<string, unknown> = {
      lineItems,
      description: raw.description?.trim() || undefined,
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
