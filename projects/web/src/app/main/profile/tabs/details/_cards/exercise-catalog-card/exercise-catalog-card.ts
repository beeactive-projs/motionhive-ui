import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { MyProfile, UserService, UserRoles, showApiError } from 'core';

/**
 * Exercise catalog browse opt-in (locked decision §19).
 *
 * Only rendered for non-instructor accounts — instructors always
 * have catalog access via their coaching role. The actual eligibility
 * gate (`opt-in OR has-any-active-assignment`) is computed
 * server-side; this card just lets the client flip the persisted
 * opt-in flag.
 *
 * The auto-enable case (a client receives a program assignment) is
 * also handled server-side; we don't try to mirror it here because
 * the FE doesn't have a cheap signal for "do you have any assignment
 * right now" without an extra round trip. A future polish pass can
 * resolve the computed eligibility into a single API field.
 */
@Component({
  selector: 'mh-exercise-catalog-card',
  imports: [FormsModule, Card, ToggleSwitch],
  templateUrl: './exercise-catalog-card.html',
  styleUrl: './exercise-catalog-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseCatalogCard {
  readonly profile = input.required<MyProfile>();
  readonly refresh = output<void>();

  private readonly _userService = inject(UserService);
  private readonly _messageService = inject(MessageService);

  readonly saving = signal(false);

  readonly visible = computed(
    () => !this.profile().roles.includes(UserRoles.Instructor),
  );

  readonly optIn = computed(
    () => this.profile().account.exerciseCatalogOptIn === true,
  );

  toggle(next: boolean): void {
    if (this.saving()) return;
    this.saving.set(true);
    this._userService.updateMe({ exerciseCatalogOptIn: next }).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: next
            ? 'Exercise catalog enabled'
            : 'Exercise catalog disabled',
          life: 3000,
        });
        this.refresh.emit();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          'Could not update preference',
          'Try again in a moment.',
          err,
        ),
      complete: () => this.saving.set(false),
    });
  }
}
