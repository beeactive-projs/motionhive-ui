import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  input,
  inject,
  DestroyRef,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import type { MenuItem } from 'primeng/api';
import { AuthService } from 'core';
import { ThemeToggleComponent } from '../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-sidenav-layout',
  imports: [RouterLink, RouterLinkActive, ButtonModule, ToolbarModule, ThemeToggleComponent],
  templateUrl: './sidenav-layout.component.html',
  styleUrl: './sidenav-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidenavLayoutComponent {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authService = inject(AuthService);
  private readonly _lgQuery = window.matchMedia('(min-width: 1024px)');

  readonly menuItems = input.required<ReadonlyArray<MenuItem>>();
  readonly brandName = input('MotionHive');

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

  signOut(): void {
    this._authService.logout().subscribe(() => {
      this._router.navigate(['/auth/login']);
    });
    this._router.navigate(['/auth/login']);
  }
}
