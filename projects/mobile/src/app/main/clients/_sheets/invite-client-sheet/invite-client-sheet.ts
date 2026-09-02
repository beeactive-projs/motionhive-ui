import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  ClientService,
  CreateClientInvitation,
  UserRoles,
  UserSearchResult,
  displayName,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AvatarTone, avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { injectPeopleSearch } from '../../../../_shared/utils/people-search';
import { ShareOutcomes, shareOrCopy } from '../../../../_shared/utils/share';
import {
  CLIENT_ICONS,
  INVITE_EXPIRY_DAYS,
  InviteMode,
  InviteModes,
  inviteLink,
  isValidEmail,
} from '../../clients.config';

/**
 * Invite someone to be coached — by finding them on the platform, or by
 * email if they are not on it yet.
 *
 * The web dialog's two tabs become a full-width segment. The platform path is
 * a single pick: one person, one invitation. The email path ends on a sent
 * state rather than closing, because the response carries the signup token
 * and a coach next to their client will often want to hand the link over
 * themselves rather than wait for the email.
 */
@Component({
  selector: 'mh-invite-client-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTextarea,
    SheetShell,
  ],
  templateUrl: './invite-client-sheet.html',
  styleUrl: './invite-client-sheet.scss',
})
export class InviteClientSheet {
  private readonly _clientService = inject(ClientService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);

  /** An invitation went out — the list has a new pending row. */
  readonly sent = output<void>();

  readonly Modes = InviteModes;
  readonly expiryDays = INVITE_EXPIRY_DAYS;
  readonly skeletonRows = [1, 2, 3];

  /** Trainees only, and only ones the coach is not already connected to. */
  readonly people = injectPeopleSearch({ role: UserRoles.User, excludeConnected: true });

  readonly mode = signal<InviteMode>(InviteModes.Platform);
  readonly selected = signal<UserSearchResult | null>(null);
  readonly email = signal('');
  readonly message = signal('');
  readonly saving = signal(false);

  /** Set once an email invite lands — the token its signup link carries. */
  readonly sentToken = signal<string | null>(null);
  readonly sentEmail = signal('');

  readonly canSend = computed(() => {
    if (this.saving()) return false;
    return this.mode() === InviteModes.Platform
      ? !!this.selected()
      : isValidEmail(this.email());
  });

  /** "Send invitation · Cristi" once someone is picked. */
  readonly saveLabel = computed(() => {
    const person = this.selected();
    if (this.mode() !== InviteModes.Platform || !person) return 'Send invitation';
    const first = person.firstName?.trim() || displayName(person);
    return `Send invitation · ${first}`;
  });

  constructor() {
    addIcons(CLIENT_ICONS);

    // Seeded on open so a dismissed draft is discarded rather than carried over.
    effect(() => {
      if (!this.open()) return;
      this.mode.set(InviteModes.Platform);
      this.selected.set(null);
      this.email.set('');
      this.message.set('');
      this.sentToken.set(null);
      this.sentEmail.set('');
      this.people.clear();
    });
  }

  setMode(value: string | number | undefined): void {
    if (value !== InviteModes.Platform && value !== InviteModes.Email) return;
    this.mode.set(value);
    this.selected.set(null);
  }

  /** One pick at a time; tapping the picked person again clears it. */
  pick(person: UserSearchResult): void {
    this.selected.update((current) => (current?.id === person.id ? null : person));
  }

  isSelected(person: UserSearchResult): boolean {
    return this.selected()?.id === person.id;
  }

  nameOf(person: UserSearchResult): string {
    return displayName(person);
  }

  toneFor(id: string): AvatarTone {
    return avatarToneFor(id);
  }

  send(): void {
    if (!this.canSend()) return;

    const message = this.message().trim();
    const person = this.selected();
    const dto: CreateClientInvitation =
      this.mode() === InviteModes.Platform && person
        ? { userId: person.id, ...(message ? { message } : {}) }
        : { email: this.email().trim(), ...(message ? { message } : {}) };

    this.saving.set(true);

    this._clientService
      .sendInvitation(dto)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          this.sent.emit();
          void this._feedbackService.success('Invitation sent');

          // Only an email invite comes back with a link worth handing over.
          const token = response.request.token;
          if (this.mode() === InviteModes.Email && token) {
            this.sentEmail.set(dto.email ?? '');
            this.sentToken.set(token);
            return;
          }
          this.open.set(false);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not send the invitation.');
        },
      });
  }

  async shareLink(): Promise<void> {
    const token = this.sentToken();
    if (!token) return;

    const outcome = await shareOrCopy({
      title: 'Join me on MotionHive',
      text: 'Join me on MotionHive so we can plan your training in one place.',
      url: inviteLink(token),
    });

    if (outcome === ShareOutcomes.Copied) {
      await this._feedbackService.success('Link copied');
    } else if (outcome === ShareOutcomes.Failed) {
      await this._feedbackService.error(null, 'Could not share the link.');
    }
  }

  done(): void {
    this.open.set(false);
  }
}
