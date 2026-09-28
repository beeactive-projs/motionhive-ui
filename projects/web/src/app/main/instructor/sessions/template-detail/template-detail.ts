import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
// MessageService scoped per page so child dialogs can emit toasts.
import { catchError, forkJoin, of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProviderChip } from '../../../../_shared/components/provider-chip/provider-chip';
import { AccessChip } from '../../../../_shared/components/access-chip/access-chip';
import { TypeChip } from '../../../../_shared/components/type-chip/type-chip';
import {
  CancelScope,
  DateWindowsMs,
  EnumLabelPipe,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
  SessionTemplate,
  SessionTemplateStatus,
  SessionsInstructorStore,
  apiErrorMessage,
  appLocale,
  injectIsMobile,
  injectIsTablet,
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
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonDirective,
    InputNumberModule,
    AccessChip,
    TypeChip,
    ProviderChip,
    SessionFormDialog,
    MessageModule,
    ToastModule,
    ConfirmDialogModule,
    TranslatePipe,
    EnumLabelPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './template-detail.html',
  styleUrl: './template-detail.scss',
})
export class InstructorTemplateDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);
  // Root-scoped: refresh the list after the series is cancelled so the
  // template card moves out of Upcoming / Recurring tabs.
  private readonly _listStore = inject(SessionsInstructorStore);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();

  // Enum consts exposed for template comparisons — never compare against
  // raw string literals (see CLAUDE.md).
  protected readonly SessionTemplateStatus = SessionTemplateStatus;
  protected readonly SessionInstanceStatus = SessionInstanceStatus;

  readonly template = signal<SessionTemplate | null>(null);
  readonly instances = signal<SessionInstance[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyRegen = signal(false);
  readonly editOpen = signal(false);
  /** Stepper-driven count for the "Regenerate forward" card (1..12). */
  readonly regenCount = signal(4);

  /** Last (latest) scheduled occurrence — label used in the regen panel. */
  protected readonly lastOccurrenceLabel = computed(() => {
    const all = this.instances();
    if (!all.length) return this._translateService.instant('sessions.templateDetail.firstStart');
    const last = all
      .slice()
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
    return new Date(last.startAt).toLocaleDateString(appLocale(), {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  });

  /** Earliest upcoming SCHEDULED instance — what "End after this week" preserves. */
  protected readonly firstFutureInstance = computed<SessionInstance | null>(
    () => this.upcoming().find((i) => i.status === SessionInstanceStatus.Scheduled) ?? null,
  );

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

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to the list.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/coaching/sessions']);
    }
  }

  protected regenerate(): void {
    const t = this.template();
    if (!t) return;
    this.busyRegen.set(true);
    this._sessionService.regenerate(t.id, { count: this.regenCount() }).subscribe({
      next: (res) => {
        this.busyRegen.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('sessions.templateDetail.toast.extended.summary'),
          detail: this._translateService.instant(
            res.warnings.length
              ? 'sessions.templateDetail.toast.extended.detailWithConflicts'
              : 'sessions.templateDetail.toast.extended.detail',
            { count: res.generatedInstances.length, conflicts: res.warnings.length },
          ),
        });
        this._load(t.id);
      },
      error: (err: unknown) => {
        this.busyRegen.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('sessions.templateDetail.toast.extendFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        );
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
      this._messageService.add({
        severity: 'warn',
        summary: this._translateService.instant('sessions.templateDetail.toast.nothingToCancel.summary'),
        detail: this._translateService.instant('sessions.templateDetail.toast.nothingToCancel.detail'),
      });
      return;
    }
    this._confirmationService.confirm({
      header: this._translateService.instant('sessions.templateDetail.confirm.cancelSeries.header'),
      message: this._translateService.instant('sessions.templateDetail.confirm.cancelSeries.message'),
      acceptLabel: this._translateService.instant('sessions.templateDetail.confirm.cancelSeries.accept'),
      rejectLabel: this._translateService.instant('sessions.templateDetail.confirm.keepSeries'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this._sessionService
          .cancelInstance(anyInstance.id, { scope: CancelScope.Series })
          .subscribe({
            next: (res) => {
              this._messageService.add({
                severity: 'success',
                summary: this._translateService.instant('sessions.templateDetail.toast.seriesCancelled'),
                detail: this._translateService.instant('sessions.common.cancelledNotified', {
                  cancelled: res.cancelledInstanceIds.length,
                  notified: res.notifiedUserIds.length,
                }),
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
                this._messageService,
                this._translateService.instant('sessions.templateDetail.toast.cancelSeriesFailed'),
                this._translateService.instant('common.pleaseTryAgain'),
                err,
              );
            },
          });
      },
    });
  }

  /**
   * End the series after this week — keep the very next upcoming instance
   * intact, cancel everything after it. Uses the existing
   * `cancelInstance(id, scope='thisAndFuture')` endpoint against the
   * SECOND upcoming instance.
   */
  protected endAfterThisWeek(): void {
    const upcoming = this.upcoming().filter((i) => i.status === SessionInstanceStatus.Scheduled);
    if (upcoming.length < 2) {
      this._messageService.add({
        severity: 'info',
        summary: this._translateService.instant('sessions.templateDetail.toast.nothingToEnd.summary'),
        detail: this._translateService.instant('sessions.templateDetail.toast.nothingToEnd.detail'),
      });
      return;
    }
    const cutoff = upcoming[1]; // first one to cancel
    this._confirmationService.confirm({
      header: this._translateService.instant('sessions.templateDetail.confirm.endAfterWeek.header'),
      message: this._translateService.instant('sessions.templateDetail.confirm.endAfterWeek.message', {
        count: upcoming.length - 1,
        date: new Date(cutoff.startAt).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short' }),
      }),
      acceptLabel: this._translateService.instant('sessions.templateDetail.confirm.endAfterWeek.accept'),
      rejectLabel: this._translateService.instant('sessions.templateDetail.confirm.keepSeries'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        const t = this.template();
        if (!t) return;
        this._sessionService
          .cancelInstance(cutoff.id, { scope: CancelScope.ThisAndFuture })
          .subscribe({
            next: (res) => {
              this._messageService.add({
                severity: 'success',
                summary: this._translateService.instant('sessions.templateDetail.toast.seriesEnded'),
                detail: this._translateService.instant('sessions.common.cancelledNotified', {
                  cancelled: res.cancelledInstanceIds.length,
                  notified: res.notifiedUserIds.length,
                }),
              });
              this._load(t.id);
              this._listStore.reload();
            },
            error: (err: unknown) => {
              showApiError(
                this._messageService,
                this._translateService.instant('sessions.templateDetail.toast.endFailed'),
                this._translateService.instant('common.pleaseTryAgain'),
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
      template: this._sessionService.getTemplate(id).pipe(
        catchError((err: unknown) => {
          this.error.set(
            apiErrorMessage(err, this._translateService.instant('sessions.templateDetail.toast.loadFailed')),
          );
          return of(null);
        }),
      ),
      // BE defaults to a 7-day window if dateFrom/dateTo omitted (too
      // narrow for series view) and caps the range at 180 days. Use the
      // full allowed window centered around now.
      instances: this._sessionService
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
