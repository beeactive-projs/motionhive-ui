import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  SimpleChanges,
  ViewChild,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { ConversationListItem, MessageView } from 'core';
import { dayDividerLabel, groupMessages, RenderedBubble } from '../../utils/group-messages';
import { DayDivider } from '../day-divider/day-divider';
import { MessageBubble } from '../message-bubble/message-bubble';
import { SystemEvent } from '../system-event/system-event';

/**
 * Scrollable list of messages. Three responsibilities:
 *
 *   1. Render — bubbles + day dividers + system pills (system pills
 *      reserved for groups, not rendered in v1).
 *   2. Pagination — emit `loadOlder` when the user scrolls within
 *      `LOAD_OLDER_THRESHOLD_PX` of the top. The store handles
 *      idempotency.
 *   3. Auto-scroll — pin to bottom on first load + on new messages
 *      when the user is already near the bottom. Otherwise the
 *      "↓ N new" chip wires up in F4 alongside the composer
 *      (because the chip only matters once we have a way to send).
 *
 * Scroll restoration across thread switches is intentionally simple:
 * each conversation resets to "scrolled to bottom" on first paint.
 * Mid-thread scroll position survives in the cache (the messages
 * stay in the store) but the DOM container is per-conversation so
 * the scrollTop visually resets — acceptable for v1 since the inbox
 * usage pattern is "open thread, read, leave".
 */
const LOAD_OLDER_THRESHOLD_PX = 200;
const NEAR_BOTTOM_PX = 100;

@Component({
  selector: 'mh-chat-thread',
  standalone: true,
  imports: [DayDivider, MessageBubble, SystemEvent],
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThread implements AfterViewInit, OnChanges {
  readonly conversation = input.required<ConversationListItem>();
  readonly messages = input.required<MessageView[]>();
  readonly currentUserId = input.required<string | null>();
  readonly loadingOlder = input<boolean>(false);
  readonly hasOlder = input<boolean>(false);

  readonly loadOlder = output<void>();

  @ViewChild('scrollContainer', { static: true })
  private scrollContainer!: ElementRef<HTMLDivElement>;

  /** Snapshot of (scrollHeight) before a prepend so we can preserve scroll position. */
  private prependAnchor: number | null = null;

  protected readonly rendered = computed<RenderedBubble[]>(() => groupMessages(this.messages()));

  constructor() {
    // Whenever the message list changes, decide what to do with the
    // scroll position AFTER Angular has rendered the new rows.
    // queueMicrotask defers to the next microtask — by then the DOM
    // has the new content.
    effect(() => {
      const _ = this.messages(); // track the signal
      queueMicrotask(() => this.handlePostRenderScroll());
    });
  }

  ngAfterViewInit(): void {
    // First paint always pins to the bottom.
    this.scrollToBottom();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Thread switch: reset scroll to bottom on the new thread.
    if (changes['conversation'] && !changes['conversation'].firstChange) {
      queueMicrotask(() => this.scrollToBottom());
    }
  }

  @HostListener('scroll')
  protected onScrollHost(): void {
    // Listener registered on the host element but actual scroll is
    // on the inner container — see template. NOOP here to keep the
    // host attribute lint-clean.
  }

  protected onScrollContainer(): void {
    const el = this.scrollContainer.nativeElement;
    if (
      el.scrollTop <= LOAD_OLDER_THRESHOLD_PX &&
      this.hasOlder() &&
      !this.loadingOlder()
    ) {
      // Capture anchor so we can keep visual position after prepend.
      this.prependAnchor = el.scrollHeight;
      this.loadOlder.emit();
    }
  }

  /** Day divider label helper (called from the template). */
  protected dayLabel(key: string): string {
    return dayDividerLabel(key);
  }

  protected trackByMessageId(_: number, b: RenderedBubble): string {
    return b.message.id;
  }

  // ─── Scroll behavior ─────────────────────────────────────────

  private handlePostRenderScroll(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;

    // If we just prepended (pagination), preserve the visual position
    // by offsetting scrollTop by the amount the content grew.
    if (this.prependAnchor !== null) {
      const delta = el.scrollHeight - this.prependAnchor;
      el.scrollTop = el.scrollTop + delta;
      this.prependAnchor = null;
      return;
    }

    // Otherwise: if the user is already near the bottom, auto-scroll
    // to keep them pinned. Otherwise leave their position alone — the
    // "↓ N new" chip (F4) tells them new content arrived.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= NEAR_BOTTOM_PX) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
