import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  ViewWillLeave,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Keyboard } from '@capacitor/keyboard';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  MessagingStore,
  dayDividerLabel,
  displayName,
  groupMessages,
} from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ChatComposer } from '../_components/chat-composer/chat-composer';
import { MessageBubble } from '../_components/message-bubble/message-bubble';
import { MESSAGING_ICONS } from '../messages.config';

/** How close to the bottom counts as "following the conversation". */
const FOLLOW_THRESHOLD_PX = 120;

/**
 * One conversation.
 *
 * Serves two routes. `/tabs/messages/:id` is an existing thread;
 * `/tabs/messages/new?to=…` is a draft addressed by recipient, with no
 * conversation behind it until the first send creates one.
 */
@Component({
  selector: 'mh-chat',
  imports: [
    ChatComposer,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
    MessageBubble,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements ViewWillLeave {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  readonly store = inject(MessagingStore);

  private readonly _content = viewChild(IonContent);

  /** Null on the draft route — there is no conversation until the first send. */
  readonly conversationId = signal<string | null>(null);

  /** Draft route only: who the first message goes to, from `?to=`. */
  private readonly _draftRecipientId = signal<string | null>(null);
  private readonly _draftRecipientName = signal<string>('');

  readonly currentUserId = computed(() => this._authStore.user()?.id ?? null);

  readonly conversation = this.store.activeConversation;

  readonly otherUser = computed(() => this.conversation()?.otherUser ?? null);

  readonly isDraft = computed(() => this.conversationId() === null);

  readonly title = computed(() => {
    const other = this.otherUser();
    if (other) return displayName(other);
    // A draft carries the name in the query string, so the header is right
    // before any participant snapshot exists. A real thread whose inbox row
    // hasn't arrived yet gets nothing rather than someone else's name.
    return this.isDraft() ? this._draftRecipientName() || 'New message' : '';
  });

  readonly tone = computed(() =>
    avatarToneFor(this.otherUser()?.id ?? this._draftRecipientId()),
  );

  readonly avatarUrl = computed(() => this.otherUser()?.avatarUrl ?? null);

  readonly handle = computed(() => this.otherUser()?.handle ?? null);

  /** Who a send addresses — the thread's other participant, or the draft target. */
  readonly recipientId = computed(
    () => this.otherUser()?.id ?? this._draftRecipientId(),
  );

  private readonly _messagesState = computed(() =>
    this.store.messagesFor(this.conversationId()),
  );

  readonly loading = computed(() => this._messagesState().loading);
  readonly hasLoaded = computed(() => this._messagesState().hasLoaded);
  readonly hasOlder = computed(() => this._messagesState().nextBefore !== null);

  /** Oldest-first, each classified into its run — see core's `groupMessages`. */
  readonly bubbles = computed(() => groupMessages(this._messagesState().items));

  readonly isEmpty = computed(
    () => !this.isDraft() && this.hasLoaded() && this.bubbles().length === 0,
  );

  /**
   * My most recent message, so exactly one receipt renders — every earlier one
   * of mine is implicitly read once a later one is. Skips deleted messages and
   * system rows, which show no tick and would otherwise swallow the receipt.
   */
  readonly lastOwnMessageId = computed(() => {
    const mine = this.currentUserId();
    if (!mine) return null;
    const items = this._messagesState().items;
    for (let i = items.length - 1; i >= 0; i--) {
      const message = items[i];
      if (message.senderId === mine && !message.deletedAt && message.kind === 'TEXT') {
        return message.id;
      }
    }
    return null;
  });

  readonly otherReadAt = computed(() => this.conversation()?.lastReadByOther ?? null);

  readonly placeholder = computed(() => {
    const firstName = this.otherUser()
      ? this.title().split(' ')[0]
      : this._draftRecipientName().split(' ')[0];
    return firstName ? `Message ${firstName}…` : 'Message…';
  });

  constructor() {
    addIcons(MESSAGING_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.conversationId.set(id);
      this.store.setActiveId(id);
      // A different thread starts its own scroll history.
      this._newestId = null;
      this._count = 0;
      this._hasLanded = false;
      if (!id) return;

      this.store.loadMessages(id);
      // Deep links and cold boots arrive before the inbox does, leaving no row
      // to build the header from.
      if (!this.store.conversations().some((row) => row.id === id)) {
        this.store.loadConversations();
      }
      // Unconditional: `conversation()` is null until that list lands, so
      // gating on `unreadCount > 0` would skip the call. markRead is idempotent.
      this.store.markReadOnEntry(id);
    });

    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const recipientId = params.get('to');
        // Drafts are keyed on "no conversation yet", so a second draft to
        // someone else would inherit whatever was typed for the first.
        if (recipientId !== this._draftRecipientId()) this.store.saveDraft(null, '');
        this._draftRecipientId.set(recipientId);
        this._draftRecipientName.set(params.get('name') ?? '');
      });

    this._watchKeyboard();

    // A thread grows at both ends: new messages at the bottom, history at the
    // top when "load earlier" fetches a page. Only the first should move the
    // view — scrolling down after a prepend throws the reader back to the
    // newest message and makes the history unreachable.
    effect(() => {
      const items = this._messagesState().items;
      if (items.length === 0) return;

      const newestId = items[items.length - 1].id;
      const count = items.length;
      const grewAtBottom = newestId !== this._newestId;
      const grewAtTop = !grewAtBottom && count > this._count;
      this._newestId = newestId;
      this._count = count;

      // The state object also changes on loading flags, which move nothing.
      if (!grewAtBottom && !grewAtTop) return;

      // Wait for the rows to lay out, or we scroll to the height the content
      // had before them.
      queueMicrotask(() => void this._settleScroll(grewAtBottom));
    });
  }

  /** Newest message the view has been scrolled to. */
  private _newestId: string | null = null;
  private _count = 0;
  /** False until the first page has been scrolled into place. */
  private _hasLanded = false;

  /** Content height captured before a "load earlier" fetch. */
  private _heightBeforeOlder: number | null = null;

  private async _settleScroll(grewAtBottom: boolean): Promise<void> {
    const content = this._content();
    if (!content) return;
    const el = await content.getScrollElement();

    if (grewAtBottom) {
      // Opening a thread always lands on the newest message. After that, only
      // follow someone who is already at the bottom — yanking a reader out of
      // the history they scrolled up to is worse than a missed message.
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (!this._hasLanded || distanceFromBottom <= FOLLOW_THRESHOLD_PX) {
        await content.scrollToBottom(0);
      }
      this._hasLanded = true;
      return;
    }

    // Older page prepended. Everything moved down by however much was added, so
    // shift by the same amount to keep the reader on the message they were on.
    const before = this._heightBeforeOlder;
    if (before === null) return;
    this._heightBeforeOlder = null;
    el.scrollTop += el.scrollHeight - before;
  }

  /**
   * Follow the thread when the keyboard opens.
   *
   * `resize: 'body'` shrinks the viewport and the composer rides up with it,
   * but nothing re-anchors the scroll — so the message you were replying to
   * ends up behind the keyboard. The scroll effect cannot cover this: opening a
   * keyboard is not a change to the message list.
   */
  private _watchKeyboard(): void {
    // No Keyboard plugin on the web build, where the browser handles this
    // itself — the listener is native-only and its absence is not an error.
    const listener = Keyboard.addListener('keyboardDidShow', () => {
      void this._content()?.scrollToBottom(0);
    }).catch(() => null);

    this._destroyRef.onDestroy(() => void listener.then((handle) => handle?.remove()));
  }

  /**
   * The store treats the active conversation as "on screen": it holds back the
   * unread count and marks incoming messages read. Leaving has to clear that,
   * or messages that arrive after you walk away are read on your behalf and
   * never badge.
   */
  ionViewWillLeave(): void {
    this.store.setActiveId(null);
  }

  dayLabel(dayKey: string): string {
    return dayDividerLabel(dayKey);
  }

  isMine(senderId: string | null): boolean {
    const mine = this.currentUserId();
    return !!mine && senderId === mine;
  }

  async loadOlder(): Promise<void> {
    const id = this.conversationId();
    if (!id) return;
    const content = this._content();
    if (content) {
      this._heightBeforeOlder = (await content.getScrollElement()).scrollHeight;
    }
    this.store.loadOlderMessages(id);
  }

  openProfile(): void {
    const handle = this.handle();
    if (handle) void this._router.navigate(['/tabs/messages/person', handle]);
  }

  openDetails(): void {
    const id = this.conversationId();
    if (id) void this._router.navigate(['/tabs/messages', id, 'details']);
  }
}
