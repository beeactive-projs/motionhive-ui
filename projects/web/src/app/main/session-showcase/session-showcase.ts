import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { catchError, of } from 'rxjs';
import {
  AccessChip,
  BlockedSessionInstance,
  CapacityBar,
  MyBookingsIndexStore,
  PageShell,
  ProviderChip,
  PublicSessionInstance,
  SessionService,
  TypeChip,
  isBlockedInstance,
  showApiError,
} from 'core';
import { BookDialog } from './_dialogs/book-dialog/book-dialog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public session showcase — shown to a logged-in user (or, in a future
 * iteration, a guest) when they land on `/sessions/:id` from Discover,
 * a share link, or an instructor's profile.
 *
 * Uses `GET /sessions/instances/:id/public` which returns either a
 * `PublicSessionInstance` (everything except meeting URL / PII) or a
 * `BlockedSessionInstance` (just enough to render a "Join the group"
 * CTA without leaking the session details).
 */
@Component({
  selector: 'mh-session-showcase',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    Button,
    Message,
    Skeleton,
    Toast,
    PageShell,
    AccessChip,
    TypeChip,
    ProviderChip,
    CapacityBar,
    BookDialog,
  ],
  providers: [MessageService],
  templateUrl: './session-showcase.html',
  styleUrl: './session-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShowcase implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _sessionService = inject(SessionService);
  private readonly _messageService = inject(MessageService);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);

  protected readonly instance = signal<
    PublicSessionInstance | BlockedSessionInstance | null
  >(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly bookOpen = signal(false);

  protected readonly publicInst = computed<PublicSessionInstance | null>(() => {
    const inst = this.instance();
    if (!inst || isBlockedInstance(inst)) return null;
    return inst;
  });

  protected readonly blockedInst = computed<BlockedSessionInstance | null>(() => {
    const inst = this.instance();
    if (!inst || !isBlockedInstance(inst)) return null;
    return inst;
  });

  protected readonly tpl = computed(() => this.publicInst()?.template ?? null);

  /** Did the current user already book this instance? */
  protected readonly myBooking = computed(() => {
    const inst = this.publicInst();
    return inst ? this._myBookingsIndexStore.bookingFor(inst.id) : null;
  });

  protected readonly canBook = computed(() => {
    const inst = this.publicInst();
    if (!inst) return false;
    if (inst.status !== 'SCHEDULED') return false;
    if (this.myBooking()) return false; // already booked
    return true;
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing session id.');
      return;
    }
    // Defensive: a malformed deep-link (e.g. /sessions/my from an old
    // notification) would hit this with a non-UUID. Bail with a friendly
    // error instead of firing /sessions/instances/my/public at the BE,
    // which 400s with "Validation failed (uuid is expected)".
    if (!UUID_RE.test(id)) {
      this.error.set('That session link looks invalid.');
      return;
    }
    this._load(id);
    // Make sure we know whether the user already booked this instance.
    this._myBookingsIndexStore.ensureLoaded();
    // Deep-link from reminders / "Join now" rows: ?action=join → fetch
    // the join info immediately and open the meeting URL in a new tab.
    if (this._route.snapshot.queryParamMap.get('action') === 'join') {
      this._sessionService.joinInfo(id).subscribe({
        next: (info) => {
          if (info?.meetingUrl) window.open(info.meetingUrl, '_blank');
        },
        error: (err: unknown) => {
          showApiError(
            this._messageService,
            'Join not available yet',
            'Try again closer to the session start.',
            err,
          );
        },
      });
    }
  }

  protected onBookSuccess(): void {
    this.bookOpen.set(false);
    this._messageService.add({
      severity: 'success',
      summary: 'Booking confirmed',
      detail: 'See it in My sessions.',
    });
    // Invalidate the bookings index so the Book button flips to "Booked"
    // immediately if the user navigates back here.
    this._myBookingsIndexStore.invalidate();
    this._myBookingsIndexStore.ensureLoaded();
    void this._router.navigate(['/my/sessions']);
  }

  protected goToMySessions(): void {
    void this._router.navigate(['/my/sessions']);
  }

  protected goToGroup(): void {
    const b = this.blockedInst();
    if (b?.template?.groupId) {
      void this._router.navigate(['/groups', b.template.groupId]);
    }
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this._sessionService
      .getPublicInstance(id)
      .pipe(
        catchError((err: unknown) => {
          showApiError(this._messageService, 'Could not load session', 'Please try again.', err);
          this.error.set('Could not load this session.');
          return of(null);
        }),
      )
      .subscribe({
        next: (res) => this.instance.set(res),
        complete: () => this.loading.set(false),
      });
  }
}
