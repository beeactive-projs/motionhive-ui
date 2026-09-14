import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessagingStore } from 'core';

const MAX_BODY_LENGTH = 4000;

/**
 * Sticky composer at the bottom of the conversation pane and inside
 * the New Message picker. Same component, two contexts:
 *
 *   - Active conversation: send appends to that thread, draft is
 *     keyed by `conversationId`.
 *   - New Message picker: `conversationId` is null until the caller
 *     supplies one via the `recipientId` input + emits `submitted`.
 *
 * Keyboard:
 *   - Enter sends.
 *   - Shift+Enter inserts a newline.
 *   - Esc clears focus.
 *
 * 429: store sets `sendRateLimitedUntil`; we read it to disable the
 * send button + show a countdown tooltip.
 *
 * 403/400 etc.: store sets `sendError`; we render it inline above the
 * composer with a dismiss button.
 */
@Component({
  selector: 'mh-chat-composer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-composer.html',
  styleUrl: './chat-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComposer {
  protected readonly store = inject(MessagingStore);

  /** Existing conversation, or null when the picker hasn't picked yet. */
  readonly conversationId = input<string | null>(null);

  /** Recipient id. Required for the picker; ignored for an existing thread. */
  readonly recipientId = input<string | null>(null);

  /** Placeholder text, e.g. "Message Ana…" / "Message HIIT Strength Crew…" */
  readonly placeholder = input<string>('Message…');

  /** Disable the input entirely (e.g. picker without a recipient yet). */
  readonly disabled = input<boolean>(false);

  /** Emitted after a successful send. Caller can use it to refocus etc. */
  readonly submitted = output<string>();

  @ViewChild('textarea', { static: true })
  private textareaRef!: ElementRef<HTMLTextAreaElement>;

  /** Local mirror of the draft to drive ngModel. */
  protected readonly value = signal('');

  protected readonly tickNow = signal(Date.now());
  private tickInterval?: ReturnType<typeof setInterval>;

  protected readonly limitedSecs = computed(() => {
    const until = this.store.sendRateLimitedUntil();
    if (!until) return 0;
    const ms = until - this.tickNow();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  });

  protected readonly isRateLimited = computed(() => this.limitedSecs() > 0);

  protected readonly tooLong = computed(() => this.value().length > MAX_BODY_LENGTH);

  // Deliberately not gated on an in-flight send. The message is already
  // in the thread, so the composer has nothing left to wait for and a
  // second message should not queue behind the first.
  protected readonly canSend = computed(
    () =>
      !this.disabled() &&
      !this.isRateLimited() &&
      !this.tooLong() &&
      this.value().trim().length > 0,
  );

  constructor() {
    // Sync local mirror with the store draft whenever the active
    // conversation changes (so switching threads brings the right
    // draft back).
    effect(() => {
      const cid = this.conversationId();
      const draft = this.store.draftFor(cid);
      if (draft !== this.value()) {
        this.value.set(draft);
      }
    });

    // Keep the rate-limit countdown alive once per second WHILE a
    // limit window is active. Avoids running a permanent timer.
    effect(() => {
      const limited = this.store.sendRateLimitedUntil();
      this.stopTick();
      if (limited && limited > Date.now()) {
        this.startTick();
      }
    });
  }

  protected onModelChange(text: string): void {
    this.value.set(text);
    this.store.saveDraft(this.conversationId(), text);
    // Clear the inline error as soon as the user starts editing —
    // the previous failure message lingers across re-renders
    // otherwise and grows stale as they type a retry.
    if (text.length > 0 && this.store.sendError()) {
      this.store.clearSendError();
    }
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void this.send();
    } else if (e.key === 'Escape') {
      this.textareaRef.nativeElement.blur();
    }
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;

    const recipientId = this.recipientId();
    if (!recipientId) {
      // Picker hasn't selected anyone yet — caller should keep the
      // composer disabled. Defensive no-op.
      return;
    }

    const body = this.value().trim();

    // Clear the field on the keystroke. The store clears its own draft
    // at the same moment and restores it if the send fails, and the
    // effect above mirrors that back into this input.
    this.value.set('');

    const resultConvId = await this.store.sendMessage({
      conversationId: this.conversationId(),
      recipientId,
      body,
    });

    if (resultConvId) {
      this.submitted.emit(resultConvId);
      // Refocus the textarea after Angular paints the cleared state.
      queueMicrotask(() => this.textareaRef.nativeElement.focus());
    }
  }

  protected dismissError(): void {
    this.store.clearSendError();
  }

  private startTick(): void {
    this.tickInterval = setInterval(() => this.tickNow.set(Date.now()), 1000);
  }

  private stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopTick();
  }
}
