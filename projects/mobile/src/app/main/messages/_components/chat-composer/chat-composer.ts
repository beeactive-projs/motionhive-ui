import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonNote,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { MessagingStore } from 'core';

import { MESSAGING_ICONS } from '../../messages.config';

/** Matches the BE's cap; anything longer is rejected server-side. */
const MAX_BODY_LENGTH = 4000;

/**
 * The send bar: an auto-growing field and a send button.
 *
 * No Enter-to-send — on a phone Enter is a newline, so the button is the only
 * way to send. That is also why the field grows instead of scrolling.
 *
 * Two failures surface here rather than as a toast, because both leave the
 * message sitting in the box: a 429 counts the button down, and a rejected
 * send puts the text back so it can be edited and retried.
 */
@Component({
  selector: 'mh-chat-composer',
  imports: [IonButton, IonIcon, IonNote, IonSpinner, IonTextarea],
  templateUrl: './chat-composer.html',
  styleUrl: './chat-composer.scss',
})
export class ChatComposer implements OnDestroy {
  readonly store = inject(MessagingStore);

  /** The thread being replied to, or null before the first message is sent. */
  readonly conversationId = input<string | null>(null);
  /** Who receives it. Send is a no-op without one. */
  readonly recipientId = input<string | null>(null);
  readonly placeholder = input('Message…');

  /** Local mirror of the store draft, so typing does not round-trip. */
  readonly value = signal('');

  private readonly _now = signal(Date.now());
  private _tick: ReturnType<typeof setInterval> | undefined;

  readonly limitedSeconds = computed(() => {
    const until = this.store.sendRateLimitedUntil();
    if (!until) return 0;
    const remaining = until - this._now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  });

  readonly isRateLimited = computed(() => this.limitedSeconds() > 0);

  readonly sending = computed(() => this.store.isSending(this.conversationId()));

  readonly isTooLong = computed(() => this.value().length > MAX_BODY_LENGTH);

  readonly canSend = computed(
    () =>
      !this.sending() &&
      !this.isRateLimited() &&
      !this.isTooLong() &&
      !!this.recipientId() &&
      this.value().trim().length > 0,
  );

  constructor() {
    addIcons(MESSAGING_ICONS);

    // Bring the right draft back when the thread changes.
    effect(() => {
      const draft = this.store.draftFor(this.conversationId());
      if (draft !== this.value()) this.value.set(draft);
    });

    // Only run the countdown while a window is open. A window elapsing is not
    // a signal change, so the timer stops itself once it reaches zero.
    effect(() => {
      const open = this.isRateLimited();
      if (open && !this._tick) {
        this._tick = setInterval(() => this._now.set(Date.now()), 1000);
      } else if (!open) {
        this._stopTick();
      }
    });
  }

  ngOnDestroy(): void {
    this._stopTick();
  }

  onInput(text: string): void {
    this.value.set(text);
    this.store.saveDraft(this.conversationId(), text);
    // A previous failure goes stale as soon as the text it referred to changes.
    if (text.length > 0 && this.store.sendError()) this.store.clearSendError();
  }

  async send(): Promise<void> {
    if (!this.canSend()) return;

    const recipientId = this.recipientId();
    if (!recipientId) return;

    const body = this.value().trim();
    // Clear straight away so the field feels responsive; the store owns the
    // optimistic bubble.
    this.value.set('');

    await this.store.sendMessage({
      conversationId: this.conversationId(),
      recipientId,
      body,
    });

    // A rejected send left the box empty — put the text back so it can be
    // fixed rather than retyped.
    if (this.store.sendError()) {
      this.value.set(body);
      this.store.saveDraft(this.conversationId(), body);
    }
  }

  dismissError(): void {
    this.store.clearSendError();
  }

  private _stopTick(): void {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = undefined;
    }
  }
}
