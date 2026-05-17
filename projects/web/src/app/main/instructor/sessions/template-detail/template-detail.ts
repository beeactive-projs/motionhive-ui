import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
// MessageService scoped per page so child dialogs can emit toasts.
import { catchError, forkJoin, of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  AccessChip,
  DateWindowsMs,
  PageShell,
  ProviderChip,
  SessionInstance,
  SessionService,
  SessionTemplate,
  SessionsInstructorStore,
  TypeChip,
  apiErrorMessage,
  showApiError,
} from 'core';
import { SessionFormDialog } from '../_dialogs/session-form-dialog/session-form-dialog';

/**
 * Detail page for a recurring `SessionTemplate`.
 *
 * Shows the template config (schedule + access + venue) and a chronological
 * list of upcoming + past instances. Each row links to the instance detail
 * page so the instructor can drill in.
 *
 * Actions:
 *   - Edit metadata (title/desc/access/location — uses the same form dialog)
 *   - Regenerate next N occurrences (calls `POST /sessions/templates/:id/regenerate`)
 *
 * Cancel-the-series is not on this page — that lives on individual instance
 * detail via `<mh-cancel-session-dialog>` with `scope='series'`. We don't
 * duplicate the action here to keep one canonical entry point.
 */
@Component({
  selector: 'mh-instructor-template-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    PageShell,
    AccessChip,
    TypeChip,
    ProviderChip,
    SessionFormDialog,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './template-detail.html',
  styleUrl: './template-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorTemplateDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);
  private readonly _confirm = inject(ConfirmationService);
  // Root-scoped: refresh the list after the series is cancelled so the
  // template card moves out of Upcoming / Recurring tabs.
  private readonly _listStore = inject(SessionsInstructorStore);

  readonly template = signal<SessionTemplate | null>(null);
  readonly instances = signal<SessionInstance[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyRegen = signal(false);
  readonly editOpen = signal(false);

  readonly upcoming = computed(() => {
    const now = Date.now();
    return this.instances()
      .filter((i) => new Date(i.startAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  });

  readonly past = computed(() => {
    const now = Date.now();
    return this.instances()
      .filter((i) => new Date(i.startAt).getTime() < now)
      .sort(
        (a, b) =>
          new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      );
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this._load(id);
  }

  protected regenerate(): void {
    const t = this.template();
    if (!t) return;
    this.busyRegen.set(true);
    this._svc.regenerate(t.id, { count: 4 }).subscribe({
      next: (res) => {
        this.busyRegen.set(false);
        this._msg.add({
          severity: 'success',
          summary: 'Schedule extended',
          detail: `${res.generatedInstances.length} new occurrence(s) added.${res.warnings.length ? ` (${res.warnings.length} had conflicts)` : ''}`,
        });
        this._load(t.id);
      },
      error: (err: unknown) => {
        this.busyRegen.set(false);
        showApiError(this._msg, 'Could not extend schedule', 'Please try again.', err);
      },
    });
  }

  protected onSaved(): void {
    this.editOpen.set(false);
    const t = this.template();
    if (t) this._load(t.id);
    this._listStore.reload();
  }

  /**
   * Cancel the entire recurring series.
   *
   * Uses the existing `cancelInstance(id, scope='series')` endpoint
   * against any instance — the BE then cancels all instances + marks
   * the template ENDED.
   */
  protected cancelSeries(): void {
    const t = this.template();
    if (!t) return;
    const anyInstance =
      this.upcoming()[0] ?? this.past()[0] ?? null;
    if (!anyInstance) {
      this._msg.add({
        severity: 'warn',
        summary: 'Nothing to cancel',
        detail: 'This series has no occurrences yet.',
      });
      return;
    }
    this._confirm.confirm({
      header: 'Cancel the entire series?',
      message:
        'All upcoming occurrences will be cancelled and the series will be ended. Attendees will be notified.',
      acceptLabel: 'Yes, cancel series',
      rejectLabel: 'Keep series',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this._svc
          .cancelInstance(anyInstance.id, { scope: 'series' })
          .subscribe({
            next: (res) => {
              this._msg.add({
                severity: 'success',
                summary: 'Series cancelled',
                detail: `${res.cancelledInstanceIds.length} occurrence(s) cancelled · ${res.notifiedUserIds.length} attendee(s) notified.`,
              });
              // Refresh local detail + list store so the card disappears
              // from the Recurring tab on next visit.
              this._load(t.id);
              this._listStore.reload();
              // Navigate back to the list — the series is no longer
              // really meaningful from a "manage this template" angle.
              void this._router.navigate(['/coaching/sessions']);
            },
            error: (err: unknown) => {
              showApiError(
                this._msg,
                'Could not cancel series',
                'Please try again.',
                err,
              );
            },
          });
      },
    });
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      template: this._svc.getTemplate(id).pipe(
        catchError((err: unknown) => {
          this.error.set(apiErrorMessage(err, 'Could not load template'));
          return of(null);
        }),
      ),
      // BE defaults to a 7-day window if dateFrom/dateTo omitted (too
      // narrow for series view) and caps the range at 180 days. Use the
      // full allowed window centered around now.
      instances: this._svc
        .listInstances({
          templateId: id,
          dateFrom: new Date(Date.now() - DateWindowsMs.TemplateLookback).toISOString(),
          dateTo: new Date(Date.now() + DateWindowsMs.TemplateLookahead).toISOString(),
          limit: 100,
        })
        .pipe(catchError(() => of({ items: [] as SessionInstance[], total: 0, page: 1, pageSize: 100 }))),
    }).subscribe({
      next: ({ template, instances }) => {
        this.template.set(template);
        this.instances.set(instances.items);
      },
      complete: () => this.loading.set(false),
    });
  }

}
