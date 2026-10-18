import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Subscription, finalize, take, timer } from 'rxjs';

import {
  AccountDeletionPreview,
  AccountDeletionService,
  AuthService,
  AuthStore,
  LanguageService,
  apiErrorMessage,
  appLocale,
  deleteAccountUrl,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { Notice } from '../../../_shared/components/notice/notice';
import { ACCOUNT_ICONS } from '../account.config';

/** Seconds before another code can be asked for. */
const RESEND_COOLDOWN_S = 30;

export const DeleteSteps = {
  /** What ends now, what is erased, what is kept. */
  Explain: 'explain',
  /** The emailed code and the confirm word. */
  Confirm: 'confirm',
} as const;
export type DeleteStep = (typeof DeleteSteps)[keyof typeof DeleteSteps];

interface EndsNowLine {
  icon: string;
  text: string;
  hint?: string;
}

/** Case and accents fold away, so "sterge" confirms "ȘTERGE". */
export function foldWord(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/**
 * Deleting the account, in two steps on one screen.
 *
 * First what it means, counted for this person: what ends for other people
 * the moment they confirm (and that each of them is told), what is erased
 * after 30 days, what the law makes us keep. Then the code we email and a
 * word to type. The friction is the reading and the code, never a hidden
 * button or a plea to stay: the published policy promises not to talk
 * anyone out of it.
 */
@Component({
  selector: 'mh-delete-account',
  imports: [
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
    Notice,
    TranslatePipe,
  ],
  templateUrl: './delete-account.html',
  styleUrl: './delete-account.scss',
})
export class DeleteAccount implements OnInit {
  private readonly _deletionService = inject(AccountDeletionService);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);
  private readonly _translateService = inject(TranslateService);
  private readonly _languageService = inject(LanguageService);
  private readonly _destroyRef = inject(DestroyRef);

  /** Coaches get one more line: download the invoices they must keep. */
  readonly isCoach = inject(AuthStore).isInstructor;

  readonly Steps = DeleteSteps;
  readonly step = signal<DeleteStep>(DeleteSteps.Explain);

  readonly preview = signal<AccountDeletionPreview | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  readonly code = signal('');
  readonly word = signal('');
  readonly sending = signal(false);
  readonly deleting = signal(false);
  readonly resendIn = signal(0);
  readonly error = signal<string | null>(null);
  private _cooldown: Subscription | null = null;

  /** The word to type, in the app's language: DELETE, ȘTERGE. */
  readonly confirmWord = this._translateService.instant('account.delete.confirmWord') as string;

  readonly blocked = computed(() => this.preview()?.blockers.includes('OPEN_DISPUTE') ?? false);

  readonly erasureDate = computed(() => {
    const preview = this.preview();
    return preview
      ? new Date(preview.scheduledFor).toLocaleDateString(appLocale(), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  /** One line per thing that ends for someone else; empty when nothing does. */
  readonly endsNow = computed<EndsNowLine[]>(() => {
    const preview = this.preview();
    if (!preview) return [];
    const t = (key: string, count: number) =>
      this._translateService.instant(`account.delete.${key}`, { count }) as string;
    const { asMember: m, asCoach: c } = preview;
    const lines: EndsNowLine[] = [];
    if (c.clients) {
      lines.push({ icon: 'person-outline', text: t('coach.clients', c.clients), hint: t('coach.clientsHint', c.clients) });
    }
    if (c.subscriptions) lines.push({ icon: 'card-outline', text: t('coach.subscriptions', c.subscriptions) });
    if (c.upcomingSessions) {
      lines.push({
        icon: 'calendar-outline',
        text: t('coach.sessions', c.upcomingSessions),
        hint: t('coach.sessionsHint', c.bookedPeople),
      });
    }
    if (c.groups) {
      lines.push({ icon: 'people-outline', text: t('coach.groups', c.groups), hint: t('coach.groupsHint', c.groupMembers) });
    }
    if (m.subscriptions) lines.push({ icon: 'card-outline', text: t('member.subscriptions', m.subscriptions) });
    if (m.bookings) lines.push({ icon: 'calendar-outline', text: t('member.bookings', m.bookings) });
    if (m.coaches) lines.push({ icon: 'person-outline', text: t('member.coaches', m.coaches) });
    if (m.groups) lines.push({ icon: 'people-outline', text: t('member.groups', m.groups) });
    return lines;
  });

  readonly canDelete = computed(
    () =>
      /^\d{6}$/.test(this.code().trim()) &&
      foldWord(this.word()) === foldWord(this.confirmWord) &&
      !this.deleting(),
  );

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this._deletionService
      .preview()
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: () => this.loadFailed.set(true),
      });
  }

  /** On to the code: it is sent the moment they choose to go on. */
  goToConfirm(): void {
    if (this.blocked()) return;
    this.step.set(DeleteSteps.Confirm);
    this.sendCode();
  }

  sendCode(): void {
    if (this.sending() || this.resendIn() > 0) return;
    this.sending.set(true);
    this.error.set(null);
    this._deletionService
      .sendCode()
      .pipe(
        take(1),
        finalize(() => this.sending.set(false)),
      )
      .subscribe({
        next: () => this.startCooldown(),
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, this._translateService.instant('account.delete.codeFailed'))),
      });
  }

  deleteAccount(): void {
    if (!this.canDelete()) return;
    this.deleting.set(true);
    this.error.set(null);
    this._deletionService
      .confirm(this.code().trim())
      .pipe(take(1))
      .subscribe({
        next: ({ scheduledFor }) => {
          // The API already signed this account out everywhere.
          this._authService.endLocalSession();
          void this._navController.navigateRoot('/auth/account-closed', {
            queryParams: { until: scheduledFor },
          });
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.error.set(apiErrorMessage(err, this._translateService.instant('account.delete.failed')));
        },
      });
  }

  openPolicy(): void {
    window.open(deleteAccountUrl(this._languageService.current), '_blank', 'noopener');
  }

  private startCooldown(): void {
    this._cooldown?.unsubscribe();
    this.resendIn.set(RESEND_COOLDOWN_S);
    this._cooldown = timer(1000, 1000)
      .pipe(take(RESEND_COOLDOWN_S), takeUntilDestroyed(this._destroyRef))
      .subscribe((tick) => this.resendIn.set(RESEND_COOLDOWN_S - tick - 1));
  }
}
