import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  input,
  output,
  inject,
  DestroyRef,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { FeedbackService, Logo, NavItem, NavMode, NavSection, Segmented } from 'core';
import { ThemeToggleComponent } from '../../_shared/components/theme-toggle/theme-toggle.component';
import { ProfileMenu } from '../../_shared/components/profile-menu/profile-menu';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SearchModal } from '../../_shared/components/search-modal/search-modal';
import { SearchTriggerService } from '../../_shared/components/search-modal/search-trigger.service';
import { InstallApp } from '../../_shared/components/install-app/install-app';

@Component({
  selector: 'mh-sidenav-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    ToolbarModule,
    ThemeToggleComponent,
    Logo,
    ProfileMenu,
    NotificationBell,
    SearchModal,
    InstallApp,
    Segmented,
  ],
  templateUrl: './sidenav-layout.component.html',
  styleUrl: './sidenav-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidenavLayoutComponent {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _searchTrigger = inject(SearchTriggerService);
  private readonly _lgQuery = window.matchMedia('(min-width: 1024px)');

  readonly navSections = input.required<ReadonlyArray<NavSection>>();
  readonly isInstructor = input<boolean>(false);
  readonly brandName = input('MotionHive');

  readonly stripeDashboardClick = output<void>();

  // ── Coach / Train workspace toggle ───────────────────────────────
  /** Persisted sidebar mode; defaults to "coach" for instructors. */
  readonly mode = signal<NavMode>(this._loadMode());

  readonly modeOptions = [
    { value: 'coach', label: 'Coach' },
    { value: 'train', label: 'Train' },
  ];

  /** Toggle only appears when the rail has both a coach and a train section. */
  readonly showModeToggle = computed(
    () =>
      this.navSections().some((s) => s.mode === 'coach') &&
      this.navSections().some((s) => s.mode === 'train'),
  );

  /** Untagged sections always show; tagged ones only in the active mode. */
  readonly visibleSections = computed(() => {
    if (!this.showModeToggle()) return this.navSections();
    const m = this.mode();
    return this.navSections().filter((s) => !s.mode || s.mode === m);
  });

  setMode(mode: string): void {
    this.mode.set(mode as NavMode);
    try {
      localStorage.setItem('mh-nav-mode', mode);
    } catch {
      /* storage unavailable (private mode) — in-memory only */
    }
  }

  private _loadMode(): NavMode {
    try {
      return localStorage.getItem('mh-nav-mode') === 'train' ? 'train' : 'coach';
    } catch {
      return 'coach';
    }
  }

  private readonly _isDesktop = signal(this._lgQuery.matches);

  sidebarOpen = signal(this._lgQuery.matches);
  sidebarAnimating = signal(false);
  readonly showBackdrop = computed(() => this.sidebarOpen() && !this._isDesktop());

  /** Close sidebar on navigation when in over mode (< lg). */
  private readonly _autoCloseOnNav = this._router.events
    .pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      filter(() => !this._lgQuery.matches),
      takeUntilDestroyed(),
    )
    .subscribe(() => this.closeSidebar());

  constructor() {
    const onResize = (e: MediaQueryListEvent) => {
      this._isDesktop.set(e.matches);
      if (e.matches) {
        this.sidebarAnimating.set(true);
        this.sidebarOpen.set(true);
      } else {
        this.closeSidebar();
      }
    };

    this._lgQuery.addEventListener('change', onResize);
    this._destroyRef.onDestroy(() => this._lgQuery.removeEventListener('change', onResize));

    // Global Cmd/Ctrl-K opens the search modal — Slack/GitHub/Linear pattern.
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this._searchTrigger.toggle();
      }
    };
    window.addEventListener('keydown', onKeydown);
    this._destroyRef.onDestroy(() => window.removeEventListener('keydown', onKeydown));
  }

  openSearch(): void {
    this._searchTrigger.open();
  }

  openFeedback(): void {
    this._feedbackService.open();
  }

  onNavItemClick(item: NavItem, event: Event): void {
    if (item.action === 'stripe-dashboard') {
      event.preventDefault();
      this.stripeDashboardClick.emit();
    }
  }

  toggleSidebar(): void {
    this.sidebarAnimating.set(true);
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    if (!this.sidebarOpen()) return;
    this.sidebarAnimating.set(true);
    this.sidebarOpen.set(false);
  }

  onSidebarTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName === 'transform') {
      this.sidebarAnimating.set(false);
    }
  }
}
