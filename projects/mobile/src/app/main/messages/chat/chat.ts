import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  ViewDidLeave,
  ViewWillEnter,
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
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  MessagingStore,
  dayDividerLabel,
  displayName,
  groupMessages,
  isOptimisticMessageId,
} from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ChatComposer } from '../_components/chat-composer/chat-composer';
import { MessageBubble } from '../_components/message-bubble/message-bubble';
import { MESSAGING_ICONS } from '../messages.config';

/** How close to the bottom counts as "following the conversation". */
const FOLLOW_THRESHOLD_PX = 120;

/** Movement under which a touch on the thread is a tap, not a drag. */
const TAP_SLOP_PX = 10;

/** How far the finger travels down the thread before the keyboard closes. */
const DRAG_DISMISS_PX = 24;

/** Things inside the thread that own their tap. */
const INTERACTIVE = 'a, button, ion-button, input, textarea, [role="button"]';

/**
 * iOS: the send bar rides up with the keyboard instead of after it.
 *
 * The keyboard plugin resizes the page only once the keyboard has finished
 * rising, plus 0.2s (its `Keyboard.m`), so the bar landed on the keys about
 * half a second late. On this screen the plugin's resizing is held off and
 * the bar is lifted on `keyboardWillShow`, which arrives with the keyboard's
 * height as it starts to move. Android resizes the window itself, which the
 * plugin cannot change, and keeps the default behaviour.
 */
const FOLLOWS_KEYBOARD = Capacitor.getPlatform() === 'ios';

/**
 * The iOS keyboard's animation: its duration, and a curve close to its
 * spring (Ionic's own iOS easing). The bar and the thread both move on it.
 */
const KEYBOARD_ANIMATION_MS = 250;
const KEYBOARD_TRANSITION = `transform ${KEYBOARD_ANIMATION_MS}ms cubic-bezier(0.36, 0.66, 0.04, 1)`;

/**
 * Chat screens holding the plugin's resizing off. A count, not a flag: the
 * first send swaps the draft screen for the thread, and Ionic tells the new
 * screen it is entering before it tells the old one it is leaving, so the old
 * one must not turn resizing back on under the new one.
 */
let resizeHolds = 0;
let resizeBefore: KeyboardResize = KeyboardResize.Body;

async function holdKeyboardResize(): Promise<void> {
  if (resizeHolds++ > 0) return;
  try {
    resizeBefore = (await Keyboard.getResizeMode()).mode;
    await Keyboard.setResizeMode({ mode: KeyboardResize.None });
  } catch {
    // No plugin, nothing to hold.
  }
}

async function releaseKeyboardResize(): Promise<void> {
  if (resizeHolds === 0 || --resizeHolds > 0) return;
  await Keyboard.setResizeMode({ mode: resizeBefore }).catch(() => undefined);
}

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
    TranslatePipe,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements ViewWillEnter, ViewWillLeave, ViewDidLeave {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);
  readonly store = inject(MessagingStore);

  private readonly _content = viewChild(IonContent);
  private readonly _contentHost = viewChild(IonContent, { read: ElementRef<HTMLElement> });
  private readonly _composer = viewChild(ChatComposer);
  private readonly _footerHost = viewChild(IonFooter, { read: ElementRef<HTMLElement> });

  private _holdingResize = false;
  private _settleTimer: ReturnType<typeof setTimeout> | undefined;
  /** iOS: how far the send bar is lifted to sit on the keyboard. */
  private _lift = 0;
  /** iOS: the room under the newest message for the keyboard, once settled. */
  private _inset = 0;

  /**
   * Android: keyboard up or down, from the native events. The footer pads the
   * home indicator only while it is down; when it is up the keyboard covers
   * that strip and the bar should sit right on it. iOS keeps the padding and
   * lifts the bar by the keyboard less that padding instead.
   */
  readonly keyboardOpen = signal(false);

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
    return this.isDraft()
      ? this._draftRecipientName() || this._translateService.instant('messages.newMessage')
      : '';
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

  // A draft has no conversation behind it, so its messages live under a
  // key derived from the recipient — that is what puts a just-sent first
  // message on screen before the server has created the thread.
  private readonly _messagesState = computed(() =>
    this.conversationId()
      ? this.store.messagesFor(this.conversationId())
      : this.store.pendingMessagesFor(this.recipientId()),
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
    return firstName
      ? this._translateService.instant('messages.chat.placeholder', { name: firstName })
      : this._translateService.instant('messages.chat.placeholderGeneric');
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
    afterNextRender(() => this._watchThreadTouches());

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

      // Something just sent from this screen is always worth showing, even
      // to someone who had scrolled up to read.
      const sentHere = grewAtBottom && isOptimisticMessageId(newestId);

      // Wait for the rows to lay out, or we scroll to the height the content
      // had before them.
      queueMicrotask(() => void this._settleScroll(grewAtBottom, sentHere));
    });
  }

  /** Newest message the view has been scrolled to. */
  private _newestId: string | null = null;
  private _count = 0;
  /** False until the first page has been scrolled into place. */
  private _hasLanded = false;

  /** Content height captured before a "load earlier" fetch. */
  private _heightBeforeOlder: number | null = null;

  private async _settleScroll(grewAtBottom: boolean, sentHere = false): Promise<void> {
    const content = this._content();
    if (!content) return;
    const el = await content.getScrollElement();

    if (grewAtBottom) {
      // Opening a thread always lands on the newest message. After that, only
      // follow someone who is already at the bottom — yanking a reader out of
      // the history they scrolled up to is worse than a missed message.
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (!this._hasLanded || sentHere || distanceFromBottom <= FOLLOW_THRESHOLD_PX) {
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
    // itself — the listeners are native-only and their absence is not an error.
    const listeners = (
      FOLLOWS_KEYBOARD
        ? [
            Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) =>
              void this._liftWithKeyboard(keyboardHeight),
            ),
            Keyboard.addListener('keyboardWillHide', () => void this._lowerWithKeyboard()),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', () => {
              void this._content()?.scrollToBottom(0);
            }),
            Keyboard.addListener('keyboardWillShow', () => this.keyboardOpen.set(true)),
            Keyboard.addListener('keyboardWillHide', () => this.keyboardOpen.set(false)),
          ]
    ).map((pending) => pending.catch(() => null));

    this._destroyRef.onDestroy(() => {
      for (const listener of listeners) void listener.then((handle) => handle?.remove());
      clearTimeout(this._settleTimer);
      if (this._holdingResize) void releaseKeyboardResize();
    });
  }

  /**
   * iOS: lift the bar onto the keyboard as it rises, or as it changes height
   * while up (emoji, suggestions). The bar keeps its bottom clearance, which
   * the keyboard covers, so the lift is the keyboard less that clearance and
   * the pill lands its usual gutter above the keys.
   */
  private async _liftWithKeyboard(keyboardHeight: number): Promise<void> {
    const footer = this._footerHost()?.nativeElement;
    const toolbar = footer?.querySelector('ion-toolbar');
    const clearance = toolbar ? parseFloat(getComputedStyle(toolbar).paddingBottom) || 0 : 0;
    await this._followKeyboard(Math.max(0, Math.round(keyboardHeight - clearance)));
  }

  private async _lowerWithKeyboard(): Promise<void> {
    await this._followKeyboard(0);
  }

  /**
   * Move the bar to `lift` with the keyboard, and the thread with it when the
   * reader is following the conversation.
   *
   * Both start in the same synchronous step, on the same transition, so they
   * move as one; the bar is placed directly rather than through a binding,
   * which would land a frame later. The thread moves as a slide and, once
   * there, the slide is swapped in one frame for the same picture made of
   * room under the newest message plus a scroll, so it scrolls normally while
   * the keyboard is up. It is only ever slid up, under the header: moving
   * down, the room is turned back into an upward slide first, so no gap opens
   * below the header. A reader scrolled back through history keeps their
   * place, and the bar slides over the bottom of the thread.
   */
  private async _followKeyboard(lift: number): Promise<void> {
    if (lift === this._lift) return;
    const footer = this._footerHost()?.nativeElement;
    const host = this._contentHost()?.nativeElement;
    const scroller = await this._content()?.getScrollElement();
    if (!footer || !host || !scroller) return;

    clearTimeout(this._settleTimer);
    this._lift = lift;
    footer.style.transition = KEYBOARD_TRANSITION;
    footer.style.transform = lift ? `translate3d(0, ${-lift}px, 0)` : '';

    const following =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_THRESHOLD_PX;

    if (!following) {
      this._placeThread(host, 0, false);
      // More room now, out of sight; less room once the bar is down over it.
      if (lift > this._inset) this._resizeInset(host, scroller, lift, false);
      else {
        this._settleTimer = setTimeout(
          () => this._resizeInset(host, scroller, lift, false),
          KEYBOARD_ANIMATION_MS,
        );
      }
      return;
    }

    const base = Math.min(this._inset, lift);
    if (base < this._inset) {
      this._placeThread(host, -(this._inset - base), false);
      this._resizeInset(host, scroller, base, true);
      host.getBoundingClientRect();
    }
    this._placeThread(host, -(lift - base), true);
    this._settleTimer = setTimeout(() => {
      this._resizeInset(host, scroller, lift, true);
      this._placeThread(host, 0, false);
    }, KEYBOARD_ANIMATION_MS);
  }

  private _placeThread(host: HTMLElement, y: number, animate: boolean): void {
    host.style.transition = animate ? KEYBOARD_TRANSITION : 'none';
    host.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
  }

  /**
   * Change the room under the newest message, optionally scrolling by the
   * same amount so the picture holds still. The order matters: shrinking the
   * room first would let the browser clamp the scroll, and the scroll would
   * then be taken off twice.
   */
  private _resizeInset(
    host: HTMLElement,
    scroller: HTMLElement,
    px: number,
    keepPicture: boolean,
  ): void {
    const delta = px - this._inset;
    if (delta > 0) {
      this._setInset(host, px);
      if (keepPicture) scroller.scrollTop += delta;
    } else {
      if (keepPicture) scroller.scrollTop += delta;
      this._setInset(host, px);
    }
  }

  private _setInset(host: HTMLElement, px: number): void {
    this._inset = px;
    if (px) host.style.setProperty('--mh-keyboard-inset', `${px}px`);
    else host.style.removeProperty('--mh-keyboard-inset');
  }

  /**
   * Close the keyboard the way messaging apps do: a tap on the thread, or a
   * drag down it to read back. A webview cannot track the keyboard under the
   * finger the way iMessage does, so the drag closes it at once once the
   * finger has clearly moved down. Upward drags (towards newer messages)
   * leave it alone.
   *
   * Touch events rather than scroll events: the thread also scrolls itself
   * (to the newest message, when the keyboard opens), and that must not
   * close the keyboard it is making room for. Passive, so scrolling never
   * waits on these handlers.
   */
  private _watchThreadTouches(): void {
    const host = this._contentHost()?.nativeElement;
    if (!host) return;

    let start: { x: number; y: number; moved: boolean; dismissed: boolean } | null = null;

    const onStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      start = touch ? { x: touch.clientX, y: touch.clientY, moved: false, dismissed: false } : null;
    };

    const onMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) start.moved = true;
      if (!start.dismissed && dy > DRAG_DISMISS_PX) {
        start.dismissed = true;
        this._dismissKeyboard();
      }
    };

    const onEnd = (event: TouchEvent): void => {
      const target = event.target as Element | null;
      if (start && !start.moved && !target?.closest(INTERACTIVE)) this._dismissKeyboard();
      start = null;
    };

    const options: AddEventListenerOptions = { passive: true };
    host.addEventListener('touchstart', onStart, options);
    host.addEventListener('touchmove', onMove, options);
    host.addEventListener('touchend', onEnd, options);
    this._destroyRef.onDestroy(() => {
      host.removeEventListener('touchstart', onStart);
      host.removeEventListener('touchmove', onMove);
      host.removeEventListener('touchend', onEnd);
    });
  }

  /** Only when the field has it: a tap that finds no keyboard does nothing. */
  private _dismissKeyboard(): void {
    const composer = this._composer();
    if (composer?.hasFocus()) void composer.dismissKeyboard();
  }

  /**
   * Back on screen — returning from details or the person page. Leaving
   * cleared the active conversation, and the route params don't fire again
   * for a page Ionic kept alive, so without this the header loses its name.
   */
  ionViewWillEnter(): void {
    this.store.setActiveId(this.conversationId());
    if (FOLLOWS_KEYBOARD && !this._holdingResize) {
      this._holdingResize = true;
      void holdKeyboardResize();
    }
  }

  /** Leaving with the keyboard up would carry it onto the next screen. */
  ionViewWillLeave(): void {
    this._dismissKeyboard();
  }

  /**
   * The store treats the active conversation as "on screen": it holds back the
   * unread count and marks incoming messages read. Leaving has to clear that,
   * or messages that arrive after you walk away are read on your behalf and
   * never badge.
   *
   * On did-leave, not will-leave: a swipe back starts the leave, and one let
   * go halfway is cancelled with no event to say so, so the screen stayed with
   * its header blanked and the keyboard resizing back on.
   *
   * Only if it is still ours. The first send leaves the draft page for the new
   * thread's page, which has already claimed the active id by the time this
   * runs; clearing it then blanked the new thread's header.
   */
  ionViewDidLeave(): void {
    if (this.store.activeId() === this.conversationId()) this.store.setActiveId(null);
    // Every other screen keeps the plugin's resizing.
    if (this._holdingResize) {
      this._holdingResize = false;
      void releaseKeyboardResize();
    }
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
