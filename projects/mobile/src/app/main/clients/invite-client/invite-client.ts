import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  NavController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AuthStore,
  ClientService,
  CreateClientInvitation,
  UserRoles,
  UserSearchResult,
  displayName,
  emailErrorMessage,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { SearchbarAutofocusDirective } from '../../../_shared/directives/searchbar-autofocus.directive';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ShareOutcomes, shareOrCopy } from '../../../_shared/utils/share';
import { injectPeopleSearch } from '../../../_shared/utils/people-search';
import { InviteResultRow } from '../_components/invite-result-row/invite-result-row';
import { ClientsRefreshService } from '../_services/clients-refresh.service';
import { InviteEmailSheet } from '../_sheets/invite-email-sheet/invite-email-sheet';
import { InviteLinkSheet } from '../_sheets/invite-link-sheet/invite-link-sheet';
import { GroupSuggestionsStore } from './group-suggestions.store';
import { CoachStacks } from '../client-paths';
import { ClientFilterIds, MIN_SEARCH_LENGTH } from '../clients.filters';
import { CLIENT_ICONS } from '../clients.icons';
import {
  inviteEmail,
  inviteLink,
  inviteRowState,
  isDuplicateInvite,
  isEmailQuery,
} from '../invite.utils';

/**
 * "Invite client": one field, and what the coach types decides the door.
 *
 * A name lists people already on MotionHive; an address offers to email
 * someone who is not. That is why there is no segment and no second screen —
 * the question the old sheet asked with a toggle, the search field answers by
 * itself. After the new-message page, which asks the same kind of question
 * about a different relationship.
 *
 * A person's Invite button sends on the spot. The decision is reversible one
 * swipe away in the Clients list, and a confirmation step would make inviting
 * three people at a gym take nine taps instead of three. The row says what
 * happened rather than the page closing underneath it, so the next invitation
 * is the next tap.
 *
 * Deliberately store-free: `ClientsStore` is page-scoped to the Clients tab
 * and injecting it here would throw at runtime. What this page changes, it
 * reports through `ClientsRefreshService`.
 */
@Component({
  selector: 'mh-invite-client',
  imports: [
    EmptyState,
    HexAvatar,
    InviteEmailSheet,
    InviteLinkSheet,
    InviteResultRow,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonTitle,
    IonToolbar,
    RowSkeleton,
    SearchbarAutofocusDirective,
    TranslatePipe,
  ],
  templateUrl: './invite-client.html',
  styleUrl: './invite-client.scss',
  providers: [GroupSuggestionsStore],
})
export class InviteClient implements ViewWillEnter {
  private readonly _clientService = inject(ClientService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _clientsRefreshService = inject(ClientsRefreshService);
  private readonly _navController = inject(NavController);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);

  private readonly _emailSheet = viewChild(InviteEmailSheet);
  private readonly _linkSheet = viewChild(InviteLinkSheet);

  /** Trainees only, and only ones the coach is not already connected to. */
  readonly people = injectPeopleSearch({ role: UserRoles.User, excludeConnected: true });

  /** People from the coach's own groups who are not clients yet. */
  readonly suggestions = inject(GroupSuggestionsStore);

  readonly linkSheetOpen = signal(false);

  /** The coach's own handle — the public address a shared link points at. */
  readonly handle = computed(() => this._authStore.user()?.handle ?? null);

  readonly minSearchLength = MIN_SEARCH_LENGTH;
  readonly skeletonRows = [1, 2, 3];

  /**
   * Invited on this visit, by user id. Not a flag on the row: the result list
   * is a signal over the search stream that this page cannot write into, and
   * the next keystroke replaces it wholesale. Keyed by person, so someone
   * invited under "ana" is still invited under "ana popescu".
   */
  private readonly _invited = signal<ReadonlySet<string>>(new Set());
  /** The one send in flight. A second tap on anything is refused while set. */
  private readonly _sending = signal<string | null>(null);

  readonly emailSheetOpen = signal(false);
  readonly emailAddress = signal('');
  readonly emailSaving = signal(false);
  readonly sentToken = signal<string | null>(null);

  readonly rows = computed(() => {
    const invited = this._invited();
    const sending = this._sending();
    return this.people
      .results()
      .map((person) => ({ person, state: inviteRowState(person.id, invited, sending) }));
  });

  /** An attempt at an address, however incomplete — the email door's gate. */
  readonly isEmail = computed(() => isEmailQuery(this.people.query()));

  /** The address to invite, once it is one. */
  readonly address = computed(() => inviteEmail(this.people.query()));

  /** Why a half-typed address is not offered yet. Core writes the sentence. */
  readonly addressError = computed(() =>
    this.isEmail() && !this.address() ? emailErrorMessage(this.people.query()) : null,
  );

  /** Typed, but not yet enough for the API to search on. */
  readonly queryTooShort = computed(() => {
    const term = this.people.query().trim();
    return term.length > 0 && term.length < MIN_SEARCH_LENGTH;
  });

  readonly showStartHint = computed(() => !this.people.query().trim());

  /** Only before the first answer: later keystrokes keep the last results. */
  readonly showSkeleton = computed(
    () => this.people.isSearching() && this.people.results().length === 0,
  );

  /** Nobody found, and nothing to offer instead. */
  readonly isSearchEmpty = computed(() => this.people.isEmpty() && !this.isEmail());

  /**
   * Said once a send lands. The row's pill changes and nothing else does, so
   * a screen reader would otherwise hear nothing at all.
   */
  readonly announcement = signal('');

  /**
   * At least one invitation has gone, so there is something to go back to.
   * Done lands on the Requests chip; the back chevron keeps whichever chip
   * the coach left on. Both reload the list.
   */
  readonly anySent = computed(() => this._invited().size > 0);

  /** The suggestion rows, carrying the same pill states as a search result. */
  readonly suggestionRows = computed(() => {
    const invited = this._invited();
    const sending = this._sending();
    return this.suggestions
      .people()
      .map((person) => ({ person, state: inviteRowState(person.id, invited, sending) }));
  });

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  // The groups and their members load once; `load()` is idempotent, so a
  // return to this page after a profile costs nothing.
  ionViewWillEnter(): void {
    this.suggestions.load();
  }

  onQuery(value: string): void {
    this.people.setQuery(value);
  }

  /** One tap, one invitation. Refused while any send is in flight. */
  invite(person: UserSearchResult): void {
    if (this._sending() || this._invited().has(person.id)) return;

    const name = displayName(person);
    this._sending.set(person.id);

    this._clientService
      .sendInvitation({ userId: person.id })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => this._settle(person.id, name),
        error: (error: unknown) => {
          this._sending.set(null);
          // Already invited is not a failure — the row should say what is
          // true. The people search may not exclude PENDING relationships,
          // so someone invited earlier can come back in a later result set.
          if (isDuplicateInvite(error)) {
            this._mark(person.id);
            void this._feedbackService.success(
              this._translateService.instant('clients.toast.alreadyInvited'),
            );
            return;
          }
          void this._feedbackService.error(
            error,
            this._translateService.instant('clients.toast.sendFailed'),
          );
        },
      });
  }

  // ── The email door ───────────────────────────────────────────────────────

  /** Snapshots the address: the field stays live behind the sheet. */
  openEmailSheet(): void {
    const address = this.address();
    if (!address) return;
    this.emailAddress.set(address);
    this.sentToken.set(null);
    this.emailSheetOpen.set(true);
  }

  sendEmailInvite(message: string): void {
    if (this.emailSaving()) return;

    const email = this.emailAddress();
    const dto: CreateClientInvitation = { email, ...(message ? { message } : {}) };
    this.emailSaving.set(true);

    this._clientService
      .sendInvitation(dto)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => {
          this.emailSaving.set(false);
          this._clientsRefreshService.invalidate();
          void this._feedbackService.success(
            this._translateService.instant('clients.toast.invitationSent'),
          );
          // The sheet stays on its sent state: a coach standing next to their
          // client will often hand the link over rather than wait for mail.
          this.sentToken.set(response.request.token ?? null);
          if (!response.request.token) void this.finishEmailInvite();
        },
        error: (error: unknown) => {
          this.emailSaving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('clients.toast.sendFailed'),
          );
        },
      });
  }

  async shareInviteLink(): Promise<void> {
    const token = this.sentToken();
    if (!token) return;

    const outcome = await shareOrCopy({
      title: this._translateService.instant('clients.invite.share.title'),
      text: this._translateService.instant('clients.invite.share.text'),
      url: inviteLink(token),
    });

    if (outcome === ShareOutcomes.Copied) {
      await this._feedbackService.success(
        this._translateService.instant('toast.detail.linkCopied'),
      );
    } else if (outcome === ShareOutcomes.Failed) {
      await this._feedbackService.error(
        null,
        this._translateService.instant('clients.toast.shareFailed'),
      );
    }
  }

  /**
   * Done, from the sent state. Awaits the dismissal before routing: flipping
   * `open` only queues the binding, and a page that leaves in the same turn
   * strands the modal over the next one for good.
   */
  async finishEmailInvite(): Promise<void> {
    await this._emailSheet()?.close();
    this.emailSheetOpen.set(false);
    await this._leave();
  }

  /** The in-app path's way out, once at least one invitation has gone. */
  async done(): Promise<void> {
    await this._leave();
  }

  // ── The link door ────────────────────────────────────────────────────────

  openLinkSheet(): void {
    this.linkSheetOpen.set(true);
  }

  /**
   * No username yet, so there is no public address to share. Off to the
   * screen that sets one — awaiting the dismissal first, or the sheet is
   * stranded over the account page.
   */
  async chooseHandle(): Promise<void> {
    await this._linkSheet()?.close();
    this.linkSheetOpen.set(false);
    await this._navController.navigateForward('/tabs/more/account/profile');
  }

  /**
   * Back to the list, on the chip that shows what was just made. Through
   * `ClientsRefreshService`, not a `?filter=` on the way back: Ionic keeps the
   * URL a page was entered with and returns to it on every later back, so a
   * chip in it would be re-applied each time the coach came back from a
   * client. The bare tab root leaves nothing to replay.
   */
  private async _leave(): Promise<void> {
    this._clientsRefreshService.invalidateOn(ClientFilterIds.Requests);
    await this._navController.navigateBack(CoachStacks.Clients);
  }

  private _settle(userId: string, name: string): void {
    this._sending.set(null);
    this._mark(userId);
    this._clientsRefreshService.invalidate();
    this.announcement.set(
      this._translateService.instant('clients.invite.sentAnnouncement', { name }),
    );
    void this._feedbackService.success(
      this._translateService.instant('clients.toast.invitationSent'),
    );
  }

  private _mark(userId: string): void {
    this._invited.update((ids) => new Set(ids).add(userId));
  }
}
