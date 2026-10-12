import {
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputPassword } from 'primeng/inputpassword';
import { PASSWORD_RULES } from 'core';

/**
 * Password field for Signal Forms (`[formField]`): PrimeNG's `pInputPassword`
 * with a lock icon and a show/hide button. With `showRequirements` it lists
 * the password policy under the field, each rule marked as met while the user
 * types, so a new password never fails on a rule nobody mentioned.
 *
 * Errors show on blur (`invalid` and `touched`, both fed by the form). The
 * field is touched when focus leaves the whole field, not when it moves from
 * the input to its own show/hide button.
 */
@Component({
  selector: 'mh-password-input',
  imports: [TranslatePipe, ButtonDirective, IconField, InputIcon, InputPassword],
  templateUrl: './password-input.html',
  styleUrl: './password-input.scss',
  host: { class: 'flex flex-col gap-2', '(focusout)': 'onFocusOut($event)' },
})
export class PasswordInput implements FormValueControl<string> {
  private readonly _input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  // Bound by [formField].
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly touch = output<void>();

  readonly inputId = input.required<string>();
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly placeholder = input('');
  /** Id of the page's error message, announced with the field while it shows. */
  readonly errorId = input<string | null>(null);
  /** List the password policy under the field (creating a password, not signing in). */
  readonly showRequirements = input(false, { transform: booleanAttribute });

  protected readonly masked = signal(true);
  protected readonly showInvalid = computed(() => this.invalid() && this.touched());
  protected readonly rules = computed(() =>
    PASSWORD_RULES.map((rule) => ({ labelKey: rule.labelKey, met: rule.test(this.value()) })),
  );
  protected readonly requirementsId = computed(() => `${this.inputId()}-requirements`);
  protected readonly describedBy = computed(
    () =>
      [
        this.showInvalid() ? this.errorId() : null,
        this.showRequirements() ? this.requirementsId() : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
  );

  /** Lets the form focus this field, e.g. the first invalid one after a submit. */
  focus(options?: FocusOptions): void {
    this._input().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) {
      this.touch.emit();
    }
  }
}
