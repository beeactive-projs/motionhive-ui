import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  IonCheckbox,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessagingStore, UserSearchResult, displayName } from 'core';

import { RecentPerson } from '../../config/recent-searches.config';
import { SEND_LIMIT, shareSummary, toggleRecipient } from '../../config/share.config';
import { FeedbackService } from '../../services/feedback.service';
import { SendToService } from '../../services/send-to.service';
import { avatarToneFor } from '../../utils/avatar-tone.utils';
import { injectPeopleSearch } from '../../utils/people-search';
import { EmptyState } from '../empty-state/empty-state';
import { HexAvatar } from '../hex-avatar/hex-avatar';
import { SheetShell } from '../sheet-shell/sheet-shell';

/** How many recent chats the sheet offers before a search. */
const RECENT_LIMIT = 20;

/** A person as the sheet's rows draw them: name, photo and @handle. */
function toRecentPerson(person: UserSearchResult): RecentPerson {
  let subline: string | null = null;
  if (person.handle) {
    subline = `@${person.handle}`;
  }
  return { id: person.id, name: displayName(person), avatarUrl: person.avatarUrl, subline };
}

/**
 * "Send to…": something public into chats, to up to ten people at once.
 *
 * Recent chats first, then whoever the search finds. Picked people stay
 * picked while the search changes, and show at the top. An optional caption
 * goes with it. People the reader isn't connected with get it as a message
 * request, which the footnote says rather than asking the server about each.
 *
 * One instance, in the tab shell; `SendToService.open` names what to send.
 */
@Component({
  selector: 'mh-send-to-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSkeletonText,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './send-to-sheet.html',
})
export class SendToSheet {
  private readonly _service = inject(SendToService);
  private readonly _store = inject(MessagingStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly people = injectPeopleSearch();
  readonly limit = SEND_LIMIT;

  readonly open = signal(false);
  readonly saving = signal(false);
  readonly caption = signal('');
  readonly selected = signal<ReadonlyMap<string, RecentPerson>>(new Map());

  readonly target = this._service.target;
  readonly title = computed(() => this.target()?.title ?? '');

  /** The people of the latest chats, once each: who one sends to most. */
  private readonly _recent = computed<RecentPerson[]>(() => {
    const people: RecentPerson[] = [];
    const seen = new Set<string>();
    for (const conversation of this._store.chatConversations()) {
      const person = conversation.otherUser;
      if (!person || seen.has(person.id)) {
        continue;
      }
      seen.add(person.id);
      people.push(toRecentPerson(person));
      if (people.length >= RECENT_LIMIT) {
        break;
      }
    }
    return people;
  });

  /** Picked people first, then the search's results or the recent chats. */
  readonly rows = computed<RecentPerson[]>(() => {
    const picked = [...this.selected().values()];
    const pickedIds = new Set(picked.map((person) => person.id));
    let source = this._recent();
    if (this.people.isActive()) {
      source = this.people.results().map(toRecentPerson);
    }
    return [...picked, ...source.filter((person) => !pickedIds.has(person.id))];
  });

  /** Over the list: the search's people, or the recent chats. */
  readonly sectionLabel = computed(() => {
    if (this.people.isActive()) {
      return 'share.send.results';
    }
    return 'share.send.recent';
  });

  readonly emptyHeading = computed(() => {
    if (this.people.isActive()) {
      return 'empty.noResults';
    }
    return 'share.send.noChats';
  });

  readonly count = computed(() => this.selected().size);
  readonly isFull = computed(() => this.count() >= this.limit);
  readonly canSave = computed(() => this.count() > 0 && !this.saving());
  readonly saveLabel = computed(() =>
    this._translateService.instant('share.send.save', { count: this.count() }),
  );
  readonly showSkeleton = computed(
    () => this.people.isSearching() && this.people.results().length === 0,
  );
  readonly isEmpty = computed(() => !this.showSkeleton() && this.rows().length === 0);

  constructor() {
    // The service names a target: a fresh sheet for it.
    effect(() => {
      const target = this.target();
      untracked(() => {
        if (!target) {
          this.open.set(false);
          return;
        }
        this.selected.set(new Map());
        this.caption.set('');
        this.people.clear();
        this.open.set(true);
      });
    });
  }

  tone(person: RecentPerson): string {
    return avatarToneFor(person.id);
  }

  isSelected(person: RecentPerson): boolean {
    return this.selected().has(person.id);
  }

  toggle(person: RecentPerson): void {
    const next = toggleRecipient(this.selected(), person, this.limit);
    if (next === this.selected() && !this.isSelected(person)) {
      void this._feedbackService.error(
        null,
        this._translateService.instant('share.send.full', { count: this.limit }),
      );
      return;
    }
    this.selected.set(next);
  }

  onQuery(value: string): void {
    this.people.setQuery(value);
  }

  async save(): Promise<void> {
    const target = this.target();
    if (!target || !this.canSave()) {
      return;
    }
    this.saving.set(true);
    const results = await this._store.shareTo(
      [...this.selected().keys()],
      target.ref,
      this.caption().trim() || undefined,
    );
    this.saving.set(false);

    if (!results) {
      void this._feedbackService.error(null, this._translateService.instant('share.toast.failed'));
      return;
    }
    const summary = shareSummary(results);
    const text = this._translateService.instant(summary.key, summary.params);
    if (summary.ok) {
      void this._feedbackService.success(text);
    } else {
      void this._feedbackService.error(null, text);
    }
    this._service.close();
  }

  /** Swiped down or closed: nothing is sent. */
  onDismissed(): void {
    this._service.close();
  }
}
