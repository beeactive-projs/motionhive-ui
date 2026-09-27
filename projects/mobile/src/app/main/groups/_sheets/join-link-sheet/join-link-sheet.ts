import { Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon, IonNote, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { GroupService } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { ShareOutcomes, shareOrCopy } from '../../../../_shared/utils/share';
import { joinLinkUrl } from '../../groups.config';
import { GROUP_ICONS } from '../../groups.icons';

/**
 * The group's invite link: make one, share it, revoke it.
 *
 * A link is the only way into an invite-only group for someone you cannot
 * add as a client — so this is not a convenience, it is the door.
 *
 * Revoking is destructive in a quiet way: every copy of the old link stops
 * working, including ones already sent. The sheet says so rather than
 * leaving the owner to discover it.
 */
@Component({
  selector: 'mh-join-link-sheet',
  imports: [IonButton, IonIcon, IonNote, IonSpinner, SheetShell],
  templateUrl: './join-link-sheet.html',
  styleUrl: './join-link-sheet.scss',
})
export class JoinLinkSheet {
  private readonly _groupService = inject(GroupService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly open = model(false);
  readonly groupId = input.required<string>();
  readonly groupName = input('');
  /** The token the group already has, if any. */
  readonly token = input<string | null>(null);

  /** Fired after generate or revoke, so the group reloads its token. */
  readonly changed = output<void>();

  readonly working = signal(false);
  /** A token minted in this sheet, which outranks the one passed in. */
  private readonly _freshToken = signal<string | null>(null);

  readonly activeToken = computed(() => this._freshToken() ?? this.token());
  readonly url = computed(() => {
    const token = this.activeToken();
    return token ? joinLinkUrl(token) : '';
  });

  constructor() {
    // The feature's shared set, not a local four: `groups.icons.spec.ts`
    // checks every template in Groups against it, so a locally-registered
    // icon reads as an unregistered one.
    addIcons(GROUP_ICONS);
  }

  generate(): void {
    if (this.working()) return;
    this.working.set(true);

    this._groupService
      .generateJoinLink(this.groupId())
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.working.set(false);
          this._freshToken.set(result.token);
          void this._feedbackService.success('Invite link ready');
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.working.set(false);
          void this._feedbackService.error(error, 'Could not create an invite link.');
        },
      });
  }

  async share(): Promise<void> {
    const url = this.url();
    if (!url) return;

    const name = this.groupName();
    const outcome = await shareOrCopy({
      title: name || 'Join my group',
      text: name ? `Join ${name} on MotionHive` : 'Join my group on MotionHive',
      url,
    });

    // Only worth saying when it fell back to the clipboard — a native share
    // sheet already told them what happened.
    if (outcome === ShareOutcomes.Copied) {
      void this._feedbackService.success('Link copied');
    }
  }

  revoke(): void {
    if (this.working()) return;
    this.working.set(true);

    this._groupService
      .revokeJoinLink(this.groupId())
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.working.set(false);
          this._freshToken.set(null);
          void this._feedbackService.success('Invite link revoked');
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.working.set(false);
          void this._feedbackService.error(error, 'Could not revoke that link.');
        },
      });
  }
}
