import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { ThemeService } from '../../../_core/services/theme.service';
import { WaitlistService } from 'core';

@Component({
  selector: 'bee-public-header',
  imports: [RouterLink, RouterLinkActive, ButtonModule],
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

  onScroll(): void {
    this.scrolled.set(window.scrollY > 5);
  }

  onResize(): void {
    if (window.innerWidth >= 1024) {
      this.mobileMenuOpen.set(false);
    }
  }

  readonly navLinks = [
    { label: 'Home', path: '/', exact: true },
    { label: 'About', path: '/about', exact: true },
    { label: 'Blog', path: '/blog', exact: false },
  ];

  toggleTheme(): void {
    this._themeService.toggle();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  openSubscribe(): void {
    this._waitlistService.open('header');
    this.mobileMenuOpen.set(false);
  }
}
