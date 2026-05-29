import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import {
  FollowUpAudience,
  FollowUpResponse,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-follow-up-dialog` — send a message to the participants of a session.
 *
 * Two contexts (driven by the `context` input):
 *   - `post` (default) — after the session: "Send follow-up" framing,
 *     audience options include attended / no-show splits.
 *   - `pre` — before the session: "Message participants" framing, audience
 *     is limited to everyone (attended / no-show have no meaning yet).
 *
 * The dialog stays a single component on purpose — same form, same
 * endpoint, only labels and the audience set differ. Splitting would
 * duplicate the send/reset/error path for no real gain.
 */
@Component({
  selector: 'mh-follow-up-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, ButtonModule, TextareaModule],
  template: `
    <p-dialog
      [header]="header()"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [closable]="true"
    >
      <div class="mh-fu">
        @if (audiences().length > 1) {
          <div class="mh-fu__audience">
            <span class="mh-fu__label">Send to</span>
            <div class="mh-fu__opts">
              @for (a of audiences(); track a.value) {
                <button
                  type="button"
                  class="mh-fu__opt"
                  [class.is-active]="audience() === a.value"
                  (click)="audience.set(a.value)"
                >{{ a.label }}</button>
              }
            </div>
          </div>
        }

        @if (quickTemplates().length > 0) {
          <div class="mh-fu__audience">
            <span class="mh-fu__label">Quick templates</span>
            <div class="mh-fu__opts">
              @for (q of quickTemplates(); track q.label) {
                <button
                  type="button"
                  class="mh-fu__opt mh-fu__opt--template"
                  (click)="applyTemplate(q.body)"
                >{{ q.label }}</button>
              }
            </div>
          </div>
        }

        <div class="mh-fu__field">
          <label for="fuMsg">Message</label>
          <textarea
            id="fuMsg"
            pTextarea
            rows="5"
            fluid
            [ngModel]="message()"
            (ngModelChange)="message.set($event)"
            [placeholder]="placeholder()"
          ></textarea>
          <small class="mh-fu__hint">
            Goes to each recipient as an in-app + email notification.
          </small>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="close()" />
        <p-button
          label="Send"
          icon="pi pi-send"
          [loading]="busy()"
          [disabled]="!message().trim()"
          (onClick)="send()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .mh-fu { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
    .mh-fu__audience { display: flex; flex-direction: column; gap: 6px; }
    .mh-fu__label {
      font-size: 12px; font-weight: 700; color: var(--p-text-muted-color);
      text-transform: uppercase;
    }
    .mh-fu__opts { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .mh-fu__opt {
      padding: 6px 12px; font-size: 13px; font-weight: 600;
      background: transparent; border: 1px solid var(--p-content-border-color);
      border-radius: 8px; cursor: pointer; color: var(--p-text-muted-color);
    }
    .mh-fu__opt.is-active {
      background: var(--p-primary-500); color: var(--p-primary-contrast-color, #fff);
      border-color: var(--p-primary-500);
    }
    /* Template buttons are different from audience pills — single-shot
       "fill the textarea" actions, not exclusive selections. Style as a
       subtler ghost variant so users don't read them as selected state. */
    .mh-fu__opt--template {
      color: var(--p-text-color);
      &:hover {
        background: var(--p-primary-50);
        border-color: var(--p-primary-300);
        color: var(--p-primary-700);
      }
    }
    .mh-fu__field {
      display: flex; flex-direction: column; gap: 4px;
      label { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
    }
    .mh-fu__hint { font-size: 11px; color: var(--p-text-muted-color); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowUpDialog {
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);

  readonly visible = model(false);
  readonly instanceId = input<string | null>(null);
  readonly context = input<'pre' | 'post'>('post');
  readonly sent = output<FollowUpResponse>();

  readonly audience = signal<typeof FollowUpAudience[keyof typeof FollowUpAudience]>(
    FollowUpAudience.All,
  );
  readonly message = signal('');
  readonly busy = signal(false);

  readonly header = computed(() =>
    this.context() === 'pre' ? 'Message participants' : 'Send follow-up',
  );

  readonly placeholder = computed(() =>
    this.context() === 'pre'
      ? 'Running 10 min late — apologies! See you soon.'
      : 'Thanks for joining! Here’s the recording link…',
  );

  // `userIds` audience isn't surfaced — the picker UX isn't worth the rare use case.
  readonly audiences = computed(() =>
    this.context() === 'pre'
      ? [{ value: FollowUpAudience.All, label: 'Everyone' }]
      : [
          { value: FollowUpAudience.All, label: 'Everyone' },
          { value: FollowUpAudience.Attended, label: 'Attended only' },
          { value: FollowUpAudience.NoShow, label: 'No-shows only' },
        ],
  );

  /**
   * One-tap message templates that pre-fill the textarea. Context-aware:
   * pre-session covers "running late / venue update / what to bring",
   * post-session covers "thanks / homework / next reminder". Clicking
   * replaces whatever's currently in the textarea — instructors who want
   * to keep their draft just don't touch the templates.
   */
  readonly quickTemplates = computed(() => {
    return this.context() === 'pre'
      ? [
          {
            label: 'Running late',
            body: "Heads up — I'm running about 10 minutes behind. We'll start as soon as I'm there. Thanks for your patience!",
          },
          {
            label: 'Venue update',
            body: "Quick update on where we're meeting — same time, but a slightly different spot. I'll share the new address shortly.",
          },
          {
            label: 'What to bring',
            body: 'Bring a mat, water, and clothes you can move in. Looking forward to seeing you!',
          },
        ]
      : [
          {
            label: 'Thank you',
            body: 'Thanks for joining today — great work in there. Let me know how your body feels tomorrow.',
          },
          {
            label: 'Homework',
            body: "Here's what to practise before our next session — three sets of the breath work we covered, daily if you can.",
          },
          {
            label: 'Next reminder',
            body: "Our next session is on the books — don't forget to book in if it's a public class.",
          },
        ];
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.audience.set(FollowUpAudience.All);
        this.message.set('');
      }
    });
  }

  /** Drop the templated copy into the textarea, replacing whatever's there. */
  applyTemplate(body: string): void {
    this.message.set(body);
  }

  close(): void {
    this.visible.set(false);
  }

  send(): void {
    const id = this.instanceId();
    if (!id) return;
    const m = this.message().trim();
    if (!m) return;
    this.busy.set(true);
    this._svc
      .followUp(id, { audience: this.audience(), message: m })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.visible.set(false);
          this._msg.add({
            severity: 'success',
            summary: this.header(),
            detail: `${res.notifiedUserIds.length} recipient(s) notified.`,
          });
          this.sent.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          const summary =
            this.context() === 'pre'
              ? 'Could not send message'
              : 'Could not send follow-up';
          showApiError(this._msg, summary, 'Please try again.', err);
        },
      });
  }
}
