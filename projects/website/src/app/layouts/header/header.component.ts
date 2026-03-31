import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { ThemeService, WaitlistService, Logo } from 'core';
import { LanguageSwitcher } from '../../_shared/language-switcher/language-switcher';

@Component({
  selector: 'mh-public-header',
  imports: [RouterLink, RouterLinkActive, ButtonModule, Logo, LanguageSwitcher],
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

  readonly mobileMenuOpen = signal(false);
  readonly isDark = this._themeService.isDark;
  readonly scrolled = signal(false);

  readonly switchLightLabel = $localize`Switch to light mode`;
  readonly switchDarkLabel = $localize`Switch to dark mode`;

  readonly navLinks = [
    { label: $localize`Home`, path: '/', exact: true },
    { label: $localize`About`, path: '/about', exact: true },
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
}
