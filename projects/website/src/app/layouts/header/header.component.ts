import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Hex, Logo, SIGNUP_URL, ThemeService } from 'core';
import { LanguageSwitcher } from '../../_shared/language-switcher/language-switcher';
import { FEATURES, type MarketingFeature } from '../../_data/features';

/**
 * Public marketing header — one shell used on every page (the design had the
 * nav copied per-page; this replaces that). Contains the Features mega-menu
 * (two-pane: feature list + hovered-feature video preview), a Tools dropdown,
 * theme toggle, language switcher, the signup CTA, and a mobile hamburger →
 * drawer with an inline Features accordion.
 */
@Component({
  selector: 'mh-public-header',
  imports: [RouterLink, RouterLinkActive, Logo, LanguageSwitcher, Hex],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onScroll()',
    '(window:resize)': 'onResize()',
  },
})
export class PublicHeaderComponent {
  private readonly _theme = inject(ThemeService);
  private readonly _document = inject(DOCUMENT);

  readonly isDark = this._theme.isDark;
  readonly scrolled = signal(false);

  readonly features = FEATURES;
  readonly signupUrl = SIGNUP_URL;

  /** Desktop overlays. */
  readonly megaOpen = signal(false);
  readonly toolsOpen = signal(false);
  /** Feature whose preview shows in the mega-menu's right pane. */
  readonly activeFeature = signal<MarketingFeature>(FEATURES[0]);

  /** Mobile drawer. */
  readonly mobileOpen = signal(false);
  readonly mobileFeaturesOpen = signal(false);

  readonly switchLightLabel = $localize`:@@header.switchLight:Switch to light mode`;
  readonly switchDarkLabel = $localize`:@@header.switchDark:Switch to dark mode`;

  onScroll(): void {
    this.scrolled.set(window.scrollY > 5);
  }

  onResize(): void {
    if (window.innerWidth >= 1024 && this.mobileOpen()) this.closeMobile();
  }

  toggleTheme(): void {
    this._theme.toggle();
  }

  openMega(): void {
    this.megaOpen.set(true);
    this.toolsOpen.set(false);
  }
  closeMega(): void {
    this.megaOpen.set(false);
  }
  setActiveFeature(f: MarketingFeature): void {
    this.activeFeature.set(f);
  }

  openTools(): void {
    this.toolsOpen.set(true);
    this.megaOpen.set(false);
  }
  closeTools(): void {
    this.toolsOpen.set(false);
  }

  toggleMobile(): void {
    this.mobileOpen() ? this.closeMobile() : this._openMobile();
  }
  private _openMobile(): void {
    this.mobileOpen.set(true);
    this._document.body.style.overflow = 'hidden';
  }
  closeMobile(): void {
    this.mobileOpen.set(false);
    this.mobileFeaturesOpen.set(false);
    this._document.body.style.overflow = '';
  }
  toggleMobileFeatures(): void {
    this.mobileFeaturesOpen.update((o) => !o);
  }
}
