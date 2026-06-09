import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  JoinInfo,
  PublicSessionInstance,
  SessionService,
  showApiError,
} from 'core';

/**
 * Day-of countdown screen for online sessions.
 *
 * Reminders link to `/sessions/:id/join` ~10 min before start. The screen:
 *   - polls `/sessions/instances/:id/join-info` every 5s to keep
 *     `joinActiveFrom` / `joinActiveUntil` / `instructorJoined` fresh,
 *   - shows an MM:SS countdown until `joinActiveFrom`,
 *   - flips to an active state (teal card + big Join button) once we're
 *     inside the window,
 *   - shows an "expired" state once we're past `joinActiveUntil`.
 *
 * BE rule (see SESSION-FLOWS.md):
 *   joinActiveFrom = startAt - 5 min
 *   joinActiveUntil = startAt + 15 min
 */
@Component({
  selector: 'mh-session-day-of-online',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="mh-dof">
      @if (loading()) {
        <p class="mh-dof__loading">Loading session…</p>
      } @else if (error()) {
        <div class="mh-dof__error">
          <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
          <span>{{ error() }}</span>
          <p-button
            label="Back to my sessions"
            severity="secondary"
            [outlined]="true"
            routerLink="/user/sessions"
          />
        </div>
      } @else if (info()) {
        <header class="mh-dof__hero" [class.is-active]="isActive()" [class.is-expired]="isExpired()">
          <span class="mh-dof__eyebrow">
            @if (isExpired()) { Window expired }
            @else if (isActive()) { Join now is active }
            @else { Starts in }
          </span>

          @if (!isActive() && !isExpired()) {
            <div class="mh-dof__counter" aria-live="polite">
              <span class="mh-dof__counter-num">{{ countdownLabel() }}</span>
            </div>
          } @else if (isActive()) {
            <i class="pi pi-video mh-dof__hero-icon" aria-hidden="true"></i>
          } @else {
            <i class="pi pi-clock mh-dof__hero-icon" aria-hidden="true"></i>
          }

          <h1 class="mh-dof__title">{{ titleLabel() }}</h1>
          <p class="mh-dof__sub">{{ subLabel() }}</p>
        </header>

        @if (isActive()) {
          <div class="mh-dof__active-card">
            <span class="mh-dof__dot" aria-hidden="true"></span>
            <div>
              <strong>You're good to join.</strong>
              <small>
                @if (info()!.instructorJoined) {
                  Your instructor is already in the room.
                } @else {
                  We'll let your instructor know you're here.
                }
              </small>
            </div>
          </div>
          <p-button
            [label]="'Join ' + providerLabel()"
            icon="pi pi-arrow-right"
            iconPos="right"
            severity="primary"
            (onClick)="join()"
            styleClass="mh-dof__join-btn"
          />
        } @else if (isExpired()) {
          <p class="mh-dof__expired">
            Late? The join link stayed valid for 15 minutes after the start.
            After that it expires. Message your instructor if you still need access.
          </p>
          <p-button
            label="Back to my sessions"
            severity="secondary"
            [outlined]="true"
            routerLink="/user/sessions"
            styleClass="mh-dof__join-btn"
          />
        } @else {
          <p class="mh-dof__pre-hint">
            The Join button activates 5 minutes before the start.
            Keep this tab open — we'll flip it on automatically.
          </p>
        }
      }
    </div>

    <p-toast position="top-right" />
  `,
  styles: `
    :host { display: block; min-height: 100vh; }
    .mh-dof {
      max-width: 480px;
      margin: 0 auto;
      padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .mh-dof__loading,
    .mh-dof__error {
      padding: 32px;
      text-align: center;
      color: var(--p-text-muted-color);
    }
    .mh-dof__error {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      i { font-size: 28px; color: var(--p-red-600); }
    }
    .mh-dof__hero {
      position: relative;
      padding: 36px 24px;
      border-radius: 18px;
      text-align: center;
      color: #fff;
      background: linear-gradient(135deg, #1E3A5F 0%, #0D9488 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      overflow: hidden;
      &.is-active {
        background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
      }
      &.is-expired {
        background: linear-gradient(135deg, #3F3B33 0%, #1A1814 100%);
        opacity: 0.92;
      }
    }
    .mh-dof__eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .mh-dof__counter {
      font-feature-settings: 'tnum' 1;
      margin: 4px 0;
    }
    .mh-dof__counter-num {
      font-family: Poppins, system-ui, sans-serif;
      font-size: 64px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .mh-dof__hero-icon {
      font-size: 40px;
      margin: 8px 0;
    }
    .mh-dof__title {
      margin: 6px 0 0;
      font-size: 18px;
      font-weight: 700;
    }
    .mh-dof__sub {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
    .mh-dof__active-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: color-mix(in srgb, var(--p-teal-500, #14B8A6) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-teal-500, #14B8A6) 35%, transparent);
      border-radius: 12px;
      strong { display: block; font-size: 14px; color: var(--p-text-color); }
      small { display: block; font-size: 12px; color: var(--p-text-muted-color); margin-top: 2px; }
    }
    .mh-dof__dot {
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--p-teal-500, #14B8A6);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--p-teal-500, #14B8A6) 25%, transparent);
      flex-shrink: 0;
      animation: mh-dof-pulse 1.6s ease-in-out infinite;
    }
    @keyframes mh-dof-pulse {
      50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--p-teal-500, #14B8A6) 10%, transparent); }
    }
    :host ::ng-deep .mh-dof__join-btn { width: 100%; justify-content: center; }
    .mh-dof__expired,
    .mh-dof__pre-hint {
      font-size: 13px;
      color: var(--p-text-muted-color);
      text-align: center;
      line-height: 1.5;
      padding: 0 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDayOfOnline implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(SessionService);
  private readonly _msg = inject(MessageService);
  private readonly _destroy = inject(DestroyRef);

  /** Server's view of the join window — refreshed every 5s. */
  protected readonly info = signal<JoinInfo | null>(null);
  /** Bare instance shape we only need for the title in the hero. */
  protected readonly instance = signal<PublicSessionInstance | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Re-rendered every second to drive the MM:SS countdown. */
  private readonly _now = signal(Date.now());

  protected readonly isActive = computed(() => {
    const i = this.info();
    if (!i) return false;
    const now = this._now();
    return now >= new Date(i.joinActiveFrom).getTime()
      && now <= new Date(i.joinActiveUntil).getTime();
  });

  protected readonly isExpired = computed(() => {
    const i = this.info();
    if (!i) return false;
    return this._now() > new Date(i.joinActiveUntil).getTime();
  });

  protected readonly countdownLabel = computed(() => {
    const i = this.info();
    if (!i) return '--:--';
    const diff = new Date(i.joinActiveFrom).getTime() - this._now();
    if (diff <= 0) return '00:00';
    const mins = Math.floor(diff / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  protected readonly titleLabel = computed(() => {
    const inst = this.instance();
    return inst?.titleOverride ?? inst?.template?.title ?? 'Online session';
  });

  protected readonly subLabel = computed(() => {
    const inst = this.instance();
    if (!inst) return '';
    const start = new Date(inst.startAt).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    return `Starts at ${start} · ${inst.template?.durationMinutes ?? '?'} min`;
  });

  protected readonly providerLabel = computed(() => {
    const provider = this.instance()?.template?.meetingProvider;
    switch (provider) {
      case 'ZOOM': return 'Zoom';
      case 'GOOGLE_MEET': return 'Google Meet';
      case 'TEAMS': return 'Microsoft Teams';
      default: return 'the meeting';
    }
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing session id.');
      this.loading.set(false);
      return;
    }
    // Load instance once (for title / start time / provider label).
    this._service.getPublicInstance(id).subscribe({
      next: (inst) => {
        if ('isBlocked' in inst) {
          this.error.set('This session is not visible to you.');
          this.loading.set(false);
          return;
        }
        this.instance.set(inst);
      },
      error: (err: unknown) => {
        showApiError(this._msg, 'Could not load session', 'Try again.', err);
      },
    });
    // Tick the MM:SS counter every second.
    interval(1000)
      .pipe(takeUntilDestroyed(this._destroy))
      .subscribe(() => this._now.set(Date.now()));
    // Refresh join-info every 5s so the active window flip is timely
    // even if the user keeps the tab open across midnight or system sleep.
    this._service.joinInfo(id).subscribe({
      next: (j) => {
        this.info.set(j);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set('Join info not available yet. Try again closer to the start.');
        this.loading.set(false);
        showApiError(this._msg, 'Join not available', 'Try again closer to start.', err);
      },
    });
    interval(5000)
      .pipe(
        switchMap(() => this._service.joinInfo(id)),
        takeUntilDestroyed(this._destroy),
      )
      .subscribe({
        next: (j) => this.info.set(j),
        // Silent on poll error — keep the last known good info.
      });
  }

  protected join(): void {
    const url = this.info()?.meetingUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }
}
