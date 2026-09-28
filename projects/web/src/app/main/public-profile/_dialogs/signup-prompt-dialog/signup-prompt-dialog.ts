import { Component, computed, inject, input, model } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { LockedAction, type AvatarUser } from 'core';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

/** Icon + translation keys for the prompt's title and subtitle. */
interface PromptCopy {
  icon: string;
  titleKey: string;
  subtitleKey: string;
}

const COPY: Partial<Record<LockedAction, PromptCopy>> = {
  [LockedAction.Book]: {
    icon: 'pi-calendar',
    titleKey: 'publicProfile.signupPrompt.book.title',
    subtitleKey: 'publicProfile.signupPrompt.book.subtitle',
  },
  [LockedAction.Save]: {
    icon: 'pi-bookmark',
    titleKey: 'publicProfile.signupPrompt.save.title',
    subtitleKey: 'publicProfile.signupPrompt.save.subtitle',
  },
  [LockedAction.Group]: {
    icon: 'pi-users',
    titleKey: 'publicProfile.signupPrompt.group.title',
    subtitleKey: 'publicProfile.signupPrompt.group.subtitle',
  },
};

const FALLBACK_COPY: PromptCopy = {
  icon: 'pi-user-plus',
  titleKey: 'publicProfile.signupPrompt.fallback.title',
  subtitleKey: 'publicProfile.signupPrompt.fallback.subtitle',
};

/**
 * Guest sign-up wall shown when a logged-out viewer tries to perform a
 * locked action on the public profile (book a session, save, message,
 * etc.). Replaces the inline redirect to `/auth/signup` so the action
 * intent and the deep link back to the current profile travel with the
 * user through the auth flow.
 *
 * Both CTAs land on `/auth/signup` (which already offers email + Google
 * providers). The "Log in" link goes to `/auth/login`. All three pass
 * `next` and `intent` query params so the auth flow can resume here.
 */
@Component({
  selector: 'mh-signup-prompt-dialog',
  imports: [Dialog, ButtonDirective, Avatar, TranslatePipe],
  templateUrl: './signup-prompt-dialog.html',
  styleUrl: './signup-prompt-dialog.scss',
})
export class SignupPromptDialog {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly Actions = LockedAction;

  readonly visible = model<boolean>(false);
  readonly action = input<LockedAction>(LockedAction.Book);
  /** Path to come back to after sign-up — usually `/@handle`. */
  readonly next = input<string>('/');
  /** Instructor whose profile triggered the prompt — shown in the header. */
  readonly instructorName = input<string>('');
  readonly instructorAvatar = input<AvatarUser | null>(null);

  readonly copy = computed<PromptCopy>(() => COPY[this.action()] ?? FALLBACK_COPY);

  /** First name for the header copy. */
  readonly firstName = computed(() => {
    const name = this.instructorName().trim();
    if (!name) return this._translateService.instant('publicProfile.common.them');
    return name.split(/\s+/)[0];
  });

  goSignUp(): void {
    void this._router.navigate(['/auth/signup'], {
      queryParams: { next: this.next(), intent: this.action() },
    });
    this.visible.set(false);
  }

  goLogIn(): void {
    void this._router.navigate(['/auth/login'], {
      queryParams: { next: this.next(), intent: this.action() },
    });
    this.visible.set(false);
  }

  close(): void {
    this.visible.set(false);
  }
}
