import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { WaitlistRole } from '../../models/waitlist/waitlist.enums';
import { WaitlistService } from '../../services/waitlist/waitlist.service';

@Component({
  selector: 'bee-waitlist-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './waitlist-dialog.html',
  styleUrl: './waitlist-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitlistDialog {
  private readonly _waitlistService = inject(WaitlistService);
  private readonly _messageService = inject(MessageService);

  protected readonly visible = this._waitlistService.isOpen;
  protected readonly isLoading = signal(false);
  protected readonly submitted = signal(false);

  protected readonly roles: { key: WaitlistRole; label: string; icon: string }[] = [
    { key: 'instructor', label: 'I lead activities', icon: 'pi pi-flag' },
    { key: 'user', label: 'I join activities', icon: 'pi pi-heart' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl(''),
    email: new FormControl('', [Validators.required, Validators.email]),
    role: new FormControl<WaitlistRole | null>(null, Validators.required),
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;
    this.isLoading.set(true);
    const { name, email, role } = this.form.getRawValue();
    this._waitlistService
      .join({
        email: email!,
        role: role ?? undefined,
        source: this._waitlistService.source() ?? 'unknown',
        ...(name ? { name } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.submitted.set(true);
        },
        error: () => {
          this.isLoading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Something went wrong',
            detail: 'Could not join the waitlist. Please try again.',
            life: 5000,
          });
        },
      });
  }

  protected onClose(): void {
    this._waitlistService.close();
  }

  protected onDialogHide(): void {
    this.form.reset();
    this.submitted.set(false);
    this.isLoading.set(false);
  }
}
