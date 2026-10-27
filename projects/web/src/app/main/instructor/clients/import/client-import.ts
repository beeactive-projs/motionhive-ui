import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AppLanguage,
  ClientImportResult,
  ClientImportRow,
  ClientImportRowStatus,
  ClientImportRowStatuses,
  ClientService,
  LanguageService,
  showApiError,
  TagSeverity,
} from 'core';
import { ConfirmationService, MessageService, SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { StepperModule } from 'primeng/stepper';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { finalize } from 'rxjs';
import {
  buildImportRows,
  CLIENT_IMPORT_MAX_ROWS,
  decodeText,
  guessMapping,
  IMPORT_FIELDS,
  ImportField,
  normalizeCells,
  parseDelimited,
  ParsedSheet,
  toParsedSheet,
} from './client-import.utils';

/** 1 list, 2 columns, 3 review and send, 4 sent. */
type ImportStep = 1 | 2 | 3 | 4;

/** How a row reads on the review screen; also the summary cards that filter it. */
type ReviewCategory = 'invite' | 'fix' | 'skipped';
type ReviewFilter = 'all' | ReviewCategory;

/** A preview row as the review table draws it. */
interface ReviewRow {
  index: number;
  name: string;
  email: string;
  firstName: string | null;
  category: ReviewCategory;
  /** Ticked to be sent. Only rows that get an invite have the box. */
  included: boolean;
  /** Shows the email as an input: rows to fix, and the ones fixed in place. */
  editable: boolean;
  chipKey: string | null;
  chipSeverity: TagSeverity;
  reasonKey: string | null;
  /** When the invite already out was sent; the ALREADY_INVITED reason reads it. */
  invitedAt: string | null;
}

/** Rows to fix first, then the ones getting an invite, skipped ones last. */
const CATEGORY_ORDER: Record<ReviewCategory, number> = { fix: 0, invite: 1, skipped: 2 };

/** Why a skipped row is skipped, by what the API said about it. */
const SKIP_REASON: Partial<Record<ClientImportRowStatus, string>> = {
  DUPLICATE: 'clients.import.review.reason.DUPLICATE',
  ALREADY_INVITED: 'clients.import.review.reason.ALREADY_INVITED',
  ALREADY_CLIENT: 'clients.import.review.reason.ALREADY_CLIENT',
  ARCHIVED_CLIENT: 'clients.import.review.reason.ARCHIVED_CLIENT',
  REQUESTED_YOU: 'clients.import.review.reason.REQUESTED_YOU',
  SELF: 'clients.import.review.reason.SELF',
};

/** The fields that may only be picked once (the email has its own message). */
const SINGLE_FIELDS: readonly ImportField[] = ['firstName', 'lastName', 'fullName', 'note'];

/** The sample row in "What your list needs". Data, not copy: the same in every language. */
const GUIDE_SAMPLE = { email: 'ana@gmail.com', firstName: 'Ana', lastName: 'Pop' } as const;

/**
 * Bring a coach's client list in from a spreadsheet: read it, match its
 * columns, review what each row becomes, send. Web only on purpose; the
 * list lives on a laptop and the review needs the width.
 *
 * The file never leaves the browser. Rows go to the API as JSON, first
 * to `previewImport` (nothing saved) and, once the coach confirms, the
 * same rows minus the ones they left out to `importClients`. The API
 * decides every row the same way both times, so what the review shows is
 * what gets sent. It never says whether an address has an account.
 */
@Component({
  selector: 'mh-client-import',
  imports: [
    DatePipe,
    FormsModule,
    ButtonDirective,
    Checkbox,
    ConfirmDialogModule,
    Dialog,
    IconField,
    InputIcon,
    InputText,
    Message,
    Select,
    SelectButton,
    Skeleton,
    StepperModule,
    TagModule,
    TextareaModule,
    ToastModule,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-import.html',
})
export class ClientImport {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);
  private readonly _languageService = inject(LanguageService);
  private readonly _sanitizer = inject(DomSanitizer);
  private readonly _router = inject(Router);

  readonly maxRows = CLIENT_IMPORT_MAX_ROWS;
  readonly guideSample = GUIDE_SAMPLE;
  readonly step = signal<ImportStep>(1);

  /** The step indicator: a finished step is a way back, nothing jumps ahead. */
  readonly steps = (['list', 'columns', 'review'] as const).map((key, i) => ({
    n: (i + 1) as ImportStep,
    labelKey: `clients.import.steps.${key}`,
  }));

  // ── Step 1: the list ──────────────────────────────────────────────
  readonly pasteOpen = signal(false);
  readonly pasted = signal('');
  readonly reading = signal(false);
  readonly dragging = signal(false);
  /** Translated, shown under the drop zone. */
  readonly sourceError = signal<string | null>(null);
  /** The file's name, or null for pasted rows. */
  readonly fileName = signal<string | null>(null);

  // ── Step 2: the columns ───────────────────────────────────────────
  readonly sheet = signal<ParsedSheet | null>(null);
  readonly mapping = signal<ImportField[]>([]);
  readonly fieldOptions: SelectItem<ImportField>[] = IMPORT_FIELDS.map((field) => ({
    label: this._translateService.instant(
      field === 'email' ? 'clients.import.field.emailRequired' : `clients.import.field.${field}`,
    ),
    value: field,
  }));

  /**
   * What's wrong with the mapping, if anything. Two columns on one field
   * is reported, not silently fixed: a dropdown that changes another row
   * on its own reads as the page guessing again.
   */
  readonly mapError = computed<{ key: string; params?: Record<string, string>; field: ImportField } | null>(() => {
    const mapping = this.mapping();
    const emails = mapping.filter((field) => field === 'email').length;
    if (emails === 0) return { key: 'clients.import.columns.error.noEmail', field: 'email' };
    if (emails > 1) return { key: 'clients.import.columns.error.twoEmails', field: 'email' };
    const twice = SINGLE_FIELDS.find((f) => mapping.filter((field) => field === f).length > 1);
    if (!twice) return null;
    return {
      key: 'clients.import.columns.error.twoOf',
      params: { field: this._translateService.instant(`clients.import.field.${twice}`) },
      field: twice,
    };
  });

  readonly columns = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return [];
    const mapping = this.mapping();
    const error = this.mapError();
    // "No email column" has no column to point at; a clash points at both.
    const clash = error && error.key !== 'clients.import.columns.error.noEmail' ? error.field : null;
    return Array.from({ length: sheet.columnCount }, (_, index) => {
      const values = sheet.rows.map((row) => row[index]).filter(Boolean);
      return {
        index,
        title: sheet.headers?.[index] || null,
        examples: values.slice(0, 3).join(', ') + (values.length > 3 ? ', …' : ''),
        ignored: mapping[index] === 'ignore',
        invalid: clash !== null && mapping[index] === clash,
      };
    });
  });

  /** How many people the current mapping reads out of the sheet. */
  readonly mappedRows = computed(() => {
    const sheet = this.sheet();
    return sheet ? buildImportRows(sheet, this.mapping()) : [];
  });

  /** The green line above the columns when the mapping is usable. */
  readonly mapNotice = computed((): { key: string; params: Record<string, number> } | null => {
    const sheet = this.sheet();
    if (!sheet || this.mapError() || this.mappedRows().length === 0) return null;
    const ignored = this.mapping().filter((field) => field === 'ignore').length;
    if (ignored > 0) {
      return {
        key: 'clients.import.columns.partial',
        params: { imported: sheet.columnCount - ignored, total: sheet.columnCount },
      };
    }
    if (!sheet.headers) return { key: 'clients.import.columns.matchedNoTitles', params: {} };
    return { key: 'clients.import.columns.matchedAll', params: { count: sheet.columnCount } };
  });

  readonly canReview = computed(
    () => !this.mapError() && this.mappedRows().length > 0 && !this.checking(),
  );

  // ── Step 3: review and send ───────────────────────────────────────
  /** What gets sent, edited in place when the coach fixes an address. */
  readonly rows = signal<ClientImportRow[]>([]);
  readonly preview = signal<ClientImportResult | null>(null);
  readonly checking = signal(false);
  /** Indexes into `rows` the coach left out. */
  readonly excluded = signal<ReadonlySet<number>>(new Set());
  /** Indexes whose address the coach typed here: they keep their input once fixed. */
  readonly edited = signal<ReadonlySet<number>>(new Set());
  readonly filter = signal<ReviewFilter>('all');
  readonly query = signal('');
  readonly message = signal('');
  readonly locale = signal<AppLanguage>(this._languageService.current);
  readonly resendPending = signal(false);
  readonly sending = signal(false);

  readonly localeOptions: SelectItem<AppLanguage>[] = this._languageService.languages.map(
    (language) => {
      const name = this._translateService.instant(`language.${language}`);
      return {
        label:
          language === this._languageService.current
            ? this._translateService.instant('clients.import.review.localeYours', { language: name })
            : name,
        value: language,
      };
    },
  );

  readonly reviewRows = computed<ReviewRow[]>(() => {
    const preview = this.preview();
    if (!preview) return [];
    const excluded = this.excluded();
    const edited = this.edited();
    const resend = this.resendPending();

    return preview.rows
      .map((row): ReviewRow => {
        const invalid = row.status === ClientImportRowStatuses.InvalidEmail;
        const sendable =
          row.status === ClientImportRowStatuses.Invite ||
          (resend && row.status === ClientImportRowStatuses.AlreadyInvited);
        const category: ReviewCategory = invalid ? 'fix' : sendable ? 'invite' : 'skipped';
        const wasEdited = edited.has(row.index);

        let chipKey: string | null = null;
        let chipSeverity: TagSeverity = TagSeverity.Secondary;
        if (invalid) {
          chipKey = row.email ? 'clients.import.review.chip.invalid' : 'clients.import.review.chip.missing';
          chipSeverity = TagSeverity.Danger;
        } else if (category === 'skipped') {
          chipKey = 'clients.import.review.chip.skipped';
        } else if (wasEdited) {
          chipKey = 'clients.import.review.chip.fixed';
          chipSeverity = TagSeverity.Success;
        }

        let reasonKey: string | null = null;
        if (invalid && /\(at\)|\[at\]/i.test(row.email)) {
          reasonKey = 'clients.import.review.reason.atSign';
        } else if (category === 'skipped') {
          reasonKey = SKIP_REASON[row.status] ?? null;
        }

        return {
          index: row.index,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
          email: row.email,
          firstName: row.firstName,
          category,
          included: sendable && !excluded.has(row.index),
          editable: invalid || wasEdited,
          chipKey,
          chipSeverity,
          reasonKey,
          invitedAt: row.invitedAt,
        };
      })
      .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.index - b.index);
  });

  readonly visibleRows = computed(() => {
    const filter = this.filter();
    const query = this.query().trim().toLowerCase();
    return this.reviewRows().filter(
      (row) =>
        (filter === 'all' || row.category === filter) &&
        (!query || `${row.name} ${row.email}`.toLowerCase().includes(query)),
    );
  });

  readonly counts = computed(() => {
    const rows = this.reviewRows();
    const sending = rows.filter((row) => row.included).length;
    const invite = rows.filter((row) => row.category === 'invite').length;
    const fix = rows.filter((row) => row.category === 'fix').length;
    const skipped = rows.filter((row) => row.category === 'skipped').length;
    return { all: rows.length, sending, invite, fix, skipped, leftOut: rows.length - sending };
  });

  /** The counts, which are also the filter: one select button, a count in each option. */
  readonly summaryOptions = computed((): (SelectItem<ReviewFilter> & { count: number; tone: string })[] => {
    const counts = this.counts();
    const option = (value: ReviewFilter, count: number, tone = '') => ({
      label: this._translateService.instant(`clients.import.review.summary.${value}`),
      value,
      count,
      tone,
    });
    return [
      option('all', counts.all),
      option('invite', counts.sending, 'text-green-700 dark:text-green-400'),
      option('fix', counts.fix, counts.fix ? 'text-orange-600 dark:text-orange-400' : ''),
      option('skipped', counts.skipped),
    ];
  });

  readonly allIncluded = computed(() => {
    const invites = this.reviewRows().filter((row) => row.category === 'invite');
    return invites.length > 0 && invites.every((row) => row.included);
  });

  readonly alreadyInvitedCount = computed(
    () => this.preview()?.counts[ClientImportRowStatuses.AlreadyInvited] ?? 0,
  );
  readonly overDailyCap = computed(() => {
    const preview = this.preview();
    return !!preview && this.counts().sending > preview.dailyRemaining;
  });
  readonly canSend = computed(
    () => !this.checking() && !this.sending() && this.counts().sending > 0 && !this.overDailyCap(),
  );

  // ── Email preview ─────────────────────────────────────────────────
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  /** The API's own rendering of the email; shown in a sandboxed frame. */
  readonly previewHtml = signal<SafeHtml | null>(null);
  /** Who the sample is addressed to: the first person getting an invite. */
  readonly previewRecipient = computed(
    () => this.reviewRows().find((row) => row.included) ?? null,
  );

  // ── Step 4: sent ──────────────────────────────────────────────────
  readonly doneStats = signal({ sent: 0, skipped: 0, leftOut: 0 });

  goToStep(n: number | undefined): void {
    if (n !== undefined && n < this.step() && this.step() !== 4) this.step.set(n as ImportStep);
  }

  // ── Step 1 ────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file again (after fixing it) still fires.
    input.value = '';
    if (file) void this.readFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.readFile(file);
  }

  usePasted(): void {
    this.fileName.set(null);
    this.useGrid(normalizeCells(parseDelimited(this.pasted())));
  }

  private async readFile(file: File): Promise<void> {
    this.sourceError.set(null);
    const name = file.name.toLowerCase();

    if (name.endsWith('.xls')) {
      this.sourceError.set(this._translateService.instant('clients.import.source.error.oldExcel'));
      return;
    }

    this.reading.set(true);
    try {
      if (name.endsWith('.xlsx')) {
        // Loaded on demand: it brings an unzipper along, and most coaches
        // will only ever open this page once.
        const { readSheet } = await import('read-excel-file/browser');
        this.useGrid(normalizeCells(await readSheet(file)), file.name);
      } else {
        this.useGrid(
          normalizeCells(parseDelimited(decodeText(await file.arrayBuffer()))),
          file.name,
        );
      }
    } catch {
      this.sourceError.set(this._translateService.instant('clients.import.source.error.unreadable'));
    } finally {
      this.reading.set(false);
    }
  }

  private useGrid(grid: string[][], fileName: string | null = null): void {
    this.sourceError.set(null);
    const sheet = toParsedSheet(grid);
    if (sheet.rows.length === 0) {
      this.sourceError.set(this._translateService.instant('clients.import.source.error.empty'));
      return;
    }
    if (sheet.rows.length > CLIENT_IMPORT_MAX_ROWS) {
      this.sourceError.set(
        this._translateService.instant('clients.import.source.error.tooMany', {
          count: sheet.rows.length,
          max: CLIENT_IMPORT_MAX_ROWS,
        }),
      );
      return;
    }
    this.fileName.set(fileName);
    this.sheet.set(sheet);
    this.mapping.set(guessMapping(sheet));
    this.step.set(2);
  }

  async downloadTemplate(): Promise<void> {
    const t = (key: string) => this._translateService.instant(`clients.import.template.${key}`);
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const header = ['email', 'firstName', 'lastName', 'note'].map((key) => ({
      value: t(`header.${key}`),
      fontWeight: 'bold' as const,
    }));
    // example.com rows: the import skips them, so a template filled in
    // around them never invites the samples.
    await writeXlsxFile(
      [
        header,
        ['ana.pop@example.com', 'Ana', 'Pop', t('sampleNote')],
        ['dan.ionescu@example.com', 'Dan', 'Ionescu', null],
      ],
      {
        sheet: t('sheetName'),
        columns: [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 48 }],
      },
    ).toFile(t('fileName'));
  }

  // ── Step 2 ────────────────────────────────────────────────────────

  setField(column: number, field: ImportField): void {
    this.mapping.update((mapping) => mapping.map((current, i) => (i === column ? field : current)));
  }

  checkList(): void {
    if (!this.canReview()) return;
    this.rows.set(this.mappedRows());
    this.excluded.set(new Set());
    this.edited.set(new Set());
    this.filter.set('all');
    this.query.set('');
    this.resendPending.set(false);
    this.runPreview(() => this.step.set(3));
  }

  // ── Step 3 ────────────────────────────────────────────────────────

  setIncluded(index: number, included: boolean): void {
    this.excluded.update((current) => {
      const next = new Set(current);
      if (included) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /** Tick or untick everyone getting an invite. */
  setAllIncluded(included: boolean): void {
    const invites = this.reviewRows().filter((row) => row.category === 'invite');
    this.excluded.update((current) => {
      const next = new Set(current);
      for (const row of invites) {
        if (included) next.delete(row.index);
        else next.add(row.index);
      }
      return next;
    });
  }

  /** A fixed address is checked again at once, since its status can change. */
  updateEmail(index: number, value: string): void {
    const email = value.trim();
    if (email === this.rows()[index]?.email) return;
    this.edited.update((current) => new Set(current).add(index));
    // A fixed address is meant to be sent: clear any earlier untick.
    this.setIncluded(index, true);
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, email } : row)));
    this.runPreview();
  }

  openPreview(): void {
    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewHtml.set(null);
    this._clientService
      .previewImportEmail({
        message: this.message().trim() || undefined,
        locale: this.locale(),
        recipientFirstName: this.previewRecipient()?.firstName ?? undefined,
      })
      .pipe(finalize(() => this.previewLoading.set(false)))
      .subscribe({
        // Our own server-rendered email, every value in it escaped there;
        // the frame is sandboxed with no permissions, so nothing in it runs.
        next: ({ html }) => this.previewHtml.set(this._sanitizer.bypassSecurityTrustHtml(html)),
        error: (err) => {
          this.previewOpen.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('clients.import.toast.previewFailed'),
            this._translateService.instant('clients.common.retryInAMoment'),
            err,
          );
        },
      });
  }

  confirmSend(): void {
    if (!this.canSend()) return;
    const count = this.counts().sending;
    this._confirmationService.confirm({
      header: this._translateService.instant('clients.import.review.confirm.header'),
      message: this._translateService.instant('clients.import.review.confirm.message', { count }),
      acceptIcon: 'pi pi-send',
      acceptButtonProps: {
        label: this._translateService.instant('clients.import.review.send', { count }),
        iconPos: 'left',
      },
      rejectButtonProps: {
        label: this._translateService.instant('clients.import.review.confirm.notYet'),
        text: true,
        severity: 'secondary',
      },
      accept: () => this.send(),
    });
  }

  private send(): void {
    const excluded = this.excluded();
    const counts = this.counts();
    this.sending.set(true);
    this._clientService
      .importClients({
        rows: this.rows().filter((_, index) => !excluded.has(index)),
        message: this.message().trim() || undefined,
        locale: this.locale(),
        resendPending: this.resendPending() || undefined,
      })
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (result) => {
          this.doneStats.set({
            sent: result.toSend,
            skipped: counts.skipped,
            leftOut: counts.fix + (counts.invite - counts.sending),
          });
          this.step.set(4);
        },
        error: (err) =>
          showApiError(
            this._messageService,
            this._translateService.instant('clients.import.toast.sendFailed'),
            this._translateService.instant('clients.common.retryInAMoment'),
            err,
          ),
      });
  }

  private runPreview(onDone?: () => void): void {
    this.checking.set(true);
    this._clientService
      .previewImport({ rows: this.rows() })
      .pipe(finalize(() => this.checking.set(false)))
      .subscribe({
        next: (result) => {
          this.preview.set(result);
          onDone?.();
        },
        error: (err) =>
          showApiError(
            this._messageService,
            this._translateService.instant('clients.import.toast.checkFailed'),
            this._translateService.instant('clients.common.retryInAMoment'),
            err,
          ),
      });
  }

  // ── Navigation ────────────────────────────────────────────────────

  goToPending(): void {
    this._router.navigate(['/coaching/pending-requests']);
  }

  goToClients(): void {
    this._router.navigate(['/coaching/clients'], { queryParams: { view: 'all' } });
  }

  startOver(): void {
    this.pasted.set('');
    this.pasteOpen.set(false);
    this.fileName.set(null);
    this.sheet.set(null);
    this.mapping.set([]);
    this.rows.set([]);
    this.preview.set(null);
    this.message.set('');
    this.step.set(1);
  }
}
