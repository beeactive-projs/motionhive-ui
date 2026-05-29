import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { LockedAction, type AvatarUser } from 'core';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

interface PromptCopy {
  icon: string;
  title: string;
  subtitle: string;
}

const COPY: Partial<Record<LockedAction, PromptCopy>> = {
  [LockedAction.Book]: {
    icon: 'pi-calendar',
    title: 'Create a free account to book sessions',
    subtitle: "Takes 30 seconds. We'll save this session for you while you sign up.",
  },
  [LockedAction.Save]: {
    icon: 'pi-bookmark',
    title: 'Save this coach to your shortlist',
    subtitle: 'Sign up free to bookmark coaches, follow workouts, and message.',
  },
  [LockedAction.Group]: {
    icon: 'pi-users',
    title: 'Join the community',
    subtitle: 'Sign up free to join groups, chat with members, and RSVP to events.',
  },
};

const FALLBACK_COPY: PromptCopy = {
  icon: 'pi-user-plus',
  title: 'Create a free account to continue',
  subtitle: "Takes 30 seconds. We'll save your place while you sign up.",
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
  imports: [Dialog, Button, Avatar],
  templateUrl: './signup-prompt-dialog.html',
  styleUrl: './signup-prompt-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupPromptDialog {
  private readonly _router = inject(Router);

  readonly Actions = LockedAction;

  readonly visible = model<boolean>(false);
  readonly action = input<LockedAction>(LockedAction.Book);
  /** Path to come back to after sign-up — usually `/@handle`. */
  readonly next = input<string>('/');
  /** Instructor whose profile triggered the prompt — shown in the header. */
  readonly instructorName = input<string>('this instructor');
  readonly instructorAvatar = input<AvatarUser | null>(null);

  readonly copy = computed<PromptCopy>(() => COPY[this.action()] ?? FALLBACK_COPY);

  /** First name for the header copy. */
  readonly firstName = computed(() => {
    const name = this.instructorName().trim();
    if (!name) return 'them';
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
