import {
  Component,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { AuthStore, displayName, MessagingStore } from 'core';
import { BlockConfirmDialog } from '../../_dialogs/block-confirm-dialog/block-confirm-dialog';
import { ReportConversationDialog } from '../../_dialogs/report-conversation-dialog/report-conversation-dialog';
import { ChatComposer } from '../chat-composer/chat-composer';
import { ChatHeader } from '../chat-header/chat-header';
import { ChatThread } from '../chat-thread/chat-thread';
import { DmDetailRail } from '../dm-detail-rail/dm-detail-rail';
import { ThreatBanner } from '../threat-banner/threat-banner';

/**
 * Right-pane content when a conversation is selected.
 *
 * Wires:
 *   - Route param `:id` → `store.setActiveId()` and a first-page load.
 *   - Auth user id → `mine` discriminator on each bubble.
 *   - Detail rail visibility toggle (drawer on <1024px, fixed at lg+).
 *
 * Composer + send arrives in F4. Block / mute action handlers here
 * are wired but the dialog UX lands in F5; for now we just call
 * `block()` directly and reload conversations on success.
 */
@Component({
  selector: 'mh-conversation-pane',
  imports: [
    BlockConfirmDialog,
    ChatComposer,
    ChatHeader,
    ChatThread,
    DmDetailRail,
    ReportConversationDialog,
    ThreatBanner,
    Toast,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './conversation-pane.html',
  styleUrl: './conversation-pane.scss',
})
export class ConversationPane {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);
  protected readonly store = inject(MessagingStore);

  protected readonly currentUserId = computed(() => this._authStore.user()?.id ?? null);

  protected readonly conversation = this.store.activeConversation;

  protected readonly messagesState = computed(() =>
    this.store.messagesFor(this.store.activeId()),
  );

  protected readonly messages = computed(() => this.messagesState().items);
  protected readonly hasOlder = computed(() => this.messagesState().nextBefore !== null);
  protected readonly loading = computed(() => this.messagesState().loading);

  /** Drawer state for the detail rail on <1024px. */
  protected readonly railOpen = signal(false);

  /** Dialog visibility flags. */
  protected readonly blockDialogVisible = signal(false);
  protected readonly reportDialogVisible = signal(false);

  /** Display name of the other participant for the dialog headings. */
  protected readonly otherName = computed(() =>
    displayName(
      this.conversation()?.otherUser,
      this._translateService.instant('messages.thisUser'),
    ),
  );

  /** "Message Ana…" — falls back to a generic prompt when the name is missing. */
  protected readonly composerPlaceholder = computed(() => {
    const other = this.conversation()?.otherUser;
    if (!other) return this._translateService.instant('messages.composer.placeholder');
    return other.firstName
      ? this._translateService.instant('messages.composer.placeholderNamed', {
          name: other.firstName,
        })
      : this._translateService.instant('messages.composer.placeholderThem');
  });

  protected readonly otherId = computed(() => this.conversation()?.otherUser?.id ?? null);

  constructor() {
    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) return;

        // Close any safety dialog left open — the user navigated to
        // a different conversation while the dialog targeted the
        // previous one. Without this, clicking through the inbox
        // would silently swap the dialog's blockedId / conversationId
        // mid-action.
        this.blockDialogVisible.set(false);
        this.reportDialogVisible.set(false);

        // Sync URL → store. We don't call `openConversation()` because
        // that would re-navigate — we're already on the right route.
        this.store.setActiveId(id);
        this.store.loadMessages(id);
        // Mark-read unconditionally — on cold-load / permalink entry,
        // `activeConversation()` is still null because the inbox list
        // hasn't loaded yet, so gating on `unreadCount > 0` would skip
        // the BE call entirely. markRead is idempotent on the BE.
        this.store.markReadOnEntry(id);
      });
  }

  protected onBack(): void {
    this.store.setActiveId(null);
    void this._router.navigate(['/messages']);
  }

  protected onToggleInfo(): void {
    this.railOpen.update((v) => !v);
  }

  protected onLoadOlder(): void {
    const id = this.store.activeId();
    if (!id) return;
    this.store.loadOlderMessages(id);
  }

  protected onBlock(): void {
    // Open the confirm dialog — actual block call happens after the
    // user confirms (+ optionally picks a reason chip).
    if (!this.otherId()) return;
    this.blockDialogVisible.set(true);
  }

  protected onReport(): void {
    if (!this.conversation()) return;
    this.reportDialogVisible.set(true);
  }

  protected async onToggleMute(): Promise<void> {
    const conv = this.conversation();
    if (!conv) return;
    const wasMuted = conv.muted;
    const ok = await this.store.toggleMute(conv.id);
    if (!ok) {
      this._messageService.add({
        severity: 'error',
        summary: this._translateService.instant('messages.toast.muteFailed'),
        detail: this._translateService.instant('common.pleaseTryAgain'),
      });
      return;
    }
    this._messageService.add({
      severity: 'success',
      summary: this._translateService.instant(
        wasMuted ? 'messages.toast.unmuted' : 'messages.toast.muted',
      ),
      detail: this._translateService.instant(
        wasMuted ? 'messages.toast.unmutedDetail' : 'messages.toast.mutedDetail',
      ),
    });
  }
}
