import { Component, booleanAttribute, computed, input, model, output, signal, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { IonBadge, IonButton, IonIcon, IonInput } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkCircle, close, eye, eyeOff } from 'ionicons/icons';
import { PASSWORD_RULES } from 'core';

/**
 * A requirement badge's `data-tone` (theme/components/ion-badge.css): met,
 * unmet once the field shows as invalid, or not yet judged. `neutral` is no
 * named hue, so it takes the stylesheet's neutral wash.
 */
const RuleTones = { Met: 'success', Unmet: 'danger', Pending: 'neutral' } as const;
type RuleTone = (typeof RuleTones)[keyof typeof RuleTones];

/**
 * Password field for Signal Forms (`[formField]`): an outlined `ion-input`
 * with a show/hide toggle. With `showRequirements` it lists the password
 * policy under the field (core's `PASSWORD_RULES`, what the API enforces),
 * each rule marked as met while the user types; once the field shows as
 * invalid, the unmet ones turn danger. The web app's `mh-password-input` is
 * the same control on PrimeNG.
 *
 * The page renders the error message under it (`.mh-helper.over`,
 * `role="alert"`). Not wired with aria-describedby: `ion-input` copies aria
 * attributes onto its inner input once, at load, so later changes never land.
 */
@Component({
  selector: 'mh-password-input',
  imports: [IonBadge, IonButton, IonIcon, IonInput, TranslatePipe],
  templateUrl: './password-input.html',
  styleUrl: './password-input.scss',
})
export class PasswordInput implements FormValueControl<string> {
  private readonly _input = viewChild.required(IonInput);

  // Bound by [formField].
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly touch = output<void>();

  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly placeholder = input('');
  readonly enterkeyhint = input<'next' | 'done' | 'go' | 'send'>('next');
  /** List the password policy under the field (creating a password, not signing in). */
  readonly showRequirements = input(false, { transform: booleanAttribute });

  /** The password is shown as plain text. */
  protected readonly revealed = signal(false);
  protected readonly rules = computed(() => {
    const showInvalid = this.invalid() && this.touched();
    return PASSWORD_RULES.map((rule) => {
      const met = rule.test(this.value());
      const tone: RuleTone = met ? RuleTones.Met : showInvalid ? RuleTones.Unmet : RuleTones.Pending;
      return { labelKey: rule.labelKey, met, tone };
    });
  });

  constructor() {
    addIcons({ checkmarkCircle, close, eye, eyeOff });
  }

  protected toggleRevealed(): void {
    this.revealed.update((revealed) => !revealed);
  }

  /** Lets the form focus this field (the host can't take focus; Ionic's input can). */
  focus(): void {
    void this._input().setFocus();
  }
}
