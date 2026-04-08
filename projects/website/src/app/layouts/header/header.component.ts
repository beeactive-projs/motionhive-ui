import { Component, signal, inject, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { map, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { Popover } from 'primeng/popover';

import { ThemeService, WaitlistService, Logo } from 'core';
import { LanguageSwitcher } from '../../_shared/language-switcher/language-switcher';

type NavChild = { label: string; path: string; exact: boolean };
type NavLink = { label: string; path?: string; exact: boolean; children?: NavChild[] };

@Component({
  selector: 'mh-public-header',
  imports: [RouterLink, RouterLinkActive, ButtonModule, PopoverModule, Logo, LanguageSwitcher],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onScroll()',
    '(window:resize)': 'onResize()',
  },
})
export class PublicHeaderComponent {
  private readonly _themeService = inject(ThemeService);
  private readonly _waitlistService = inject(WaitlistService);
  private readonly _router = inject(Router);
  private readonly _navPopover = viewChild.required<Popover>('navPopover');
  private readonly _currentUrl = toSignal(
    this._router.events.pipe(startWith(null), map(() => this._router.url)),
    { initialValue: this._router.url },
  );

  readonly mobileMenuOpen = signal(false);
  readonly isDark = this._themeService.isDark;
  readonly scrolled = signal(false);
  readonly activeDropdownChildren = signal<NavChild[]>([]);

  readonly switchLightLabel = $localize`Switch to light mode`;
  readonly switchDarkLabel = $localize`Switch to dark mode`;

  readonly navLinks: NavLink[] = [
    { label: $localize`Home`, path: '/', exact: true },
    { label: $localize`About`, path: '/about', exact: true },
    {
      label: $localize`Tools`,
      exact: false,
      children: [
        { label: $localize`Calorie calculator`, path: '/tools/calorie-calculator', exact: true },
      ],
    },
    { label: $localize`Blog`, path: '/blog', exact: false },
  ];

  onScroll(): void {
    this.scrolled.set(window.scrollY > 5);
  }

  onResize(): void {
    if (window.innerWidth >= 1024) {
      this.mobileMenuOpen.set(false);
    }
  }

  toggleTheme(): void {
    this._themeService.toggle();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  openJoinWaitlist(): void {
    this._waitlistService.open('header');
    this.mobileMenuOpen.set(false);
  }

  toggleDropdown(event: MouseEvent, children: NavChild[]): void {
    this.activeDropdownChildren.set(children);
    this._navPopover().toggle(event);
  }

  closeDropdown(): void {
    this._navPopover().hide();
  }

  isChildActive(children: NavChild[]): boolean {
    const url = this._currentUrl();
    return children.some(child => (child.exact ? url === child.path : url.startsWith(child.path)));
  }
}
