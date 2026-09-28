import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { WaitlistService, WaitlistRole, WaitlistRoles } from 'core';

@Component({
  selector: 'mh-waitlist-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DialogModule,
    InputTextModule,
    MessageModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './waitlist-dialog.html',
  styleUrl: './waitlist-dialog.scss',
})
export class WaitlistDialog {
  private readonly _waitlistService = inject(WaitlistService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  protected readonly visible = this._waitlistService.isOpen;
  protected readonly isLoading = signal(false);
  protected readonly submitted = signal(false);

  /** `label` is a translation key; the template translates it. */
  protected readonly roles: { key: WaitlistRole; label: string; icon: string }[] = [
    {
      key: WaitlistRoles.Instructor,
      label: 'components.waitlistDialog.role.instructor',
      icon: 'pi pi-flag',
    },
    { key: WaitlistRoles.User, label: 'components.waitlistDialog.role.user', icon: 'pi pi-heart' },
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
            summary: this._translateService.instant('toast.detail.somethingWentWrong'),
            detail: this._translateService.instant('components.waitlistDialog.toast.joinFailed'),
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
