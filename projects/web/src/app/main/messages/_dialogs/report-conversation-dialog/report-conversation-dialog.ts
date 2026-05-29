import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { MessageReportCategory, MessagingStore } from 'core';

const MAX_NOTES_LENGTH = 1000;

/**
 * Report-a-conversation dialog. v1 reports the conversation as a
 * whole — per-message reporting (a kebab on each bubble) is plan §14
 * post-v1 polish. The BE accepts both shapes; we pass `conversationId`
 * here.
 *
 * Categories mirror the BE's `MessageReportCategory` enum. SEXUAL is
 * shown but kept separate from the more administrative categories so
 * the moderation queue can prioritise.
 */
@Component({
  selector: 'mh-report-conversation-dialog',
  standalone: true,
  imports: [FormsModule, Button, Dialog, Textarea],
  templateUrl: './report-conversation-dialog.html',
  styleUrl: './report-conversation-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportConversationDialog {
  private readonly _store = inject(MessagingStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly conversationId = input<string | null>(null);
  readonly displayName = input<string>('this conversation');
  readonly reported = output<void>();

  protected readonly submitting = signal(false);
  protected readonly category = signal<MessageReportCategory | null>(null);
  protected readonly notes = signal('');

  protected readonly categories: { key: MessageReportCategory; label: string }[] = [
    { key: 'SPAM', label: 'Spam' },
    { key: 'SCAM', label: 'Scam / fraud' },
    { key: 'HARASSMENT', label: 'Harassment' },
    { key: 'IMPERSONATION', label: 'Impersonation' },
    { key: 'SEXUAL', label: 'Sexual content' },
    { key: 'OTHER', label: 'Other' },
  ];

  protected readonly maxNotes = MAX_NOTES_LENGTH;

  protected selectCategory(c: MessageReportCategory): void {
    this.category.set(c);
  }

  protected onNotesChange(value: string): void {
    if (value.length > MAX_NOTES_LENGTH) {
      this.notes.set(value.slice(0, MAX_NOTES_LENGTH));
      return;
    }
    this.notes.set(value);
  }

  protected canSubmit(): boolean {
    return this.category() !== null && !this.submitting();
  }

  protected async submit(): Promise<void> {
    const conversationId = this.conversationId();
    const category = this.category();
    if (!conversationId || !category || this.submitting()) return;
    this.submitting.set(true);

    const notes = this.notes().trim();
    const ok = await this._store.reportMessage({
      conversationId,
      category,
      ...(notes ? { notes } : {}),
    });

    this.submitting.set(false);

    if (ok) {
      this._messageService.add({
        severity: 'success',
        summary: 'Report submitted',
        detail: 'Our team will review it shortly. Thank you.',
      });
      this.visible.set(false);
      this.reported.emit();
    } else {
      this._messageService.add({
        severity: 'error',
        summary: 'Could not submit',
        detail: 'Please try again.',
      });
    }
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  protected onHide(): void {
    this.category.set(null);
    this.notes.set('');
  }
}
