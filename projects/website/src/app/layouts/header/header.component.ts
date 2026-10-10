import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Hex, Logo, SIGNUP_URL, ThemeService } from 'core';
import { LanguageSwitcher } from '../../_shared/language-switcher/language-switcher';
import { MobileMenuService } from '../../_shared/mobile-menu.service';
import { SwipeDismissDirective } from '../../_shared/swipe-dismiss.directive';
import { CtaPair } from '../../_shared/ui/cta-pair/cta-pair';
import { LineIcon } from '../../_shared/ui/line-icon/line-icon';
import { FEATURES, MENU_FEATURES, type MarketingFeature } from '../../_data/features';

/**
 * Public marketing header — one shell used on every page (the design had the
 * nav copied per-page; this replaces that). Contains the Features mega-menu
 * (two-pane: feature list + hovered-feature video preview), a Tools dropdown,
 * theme toggle, language switcher, the signup CTA, and a mobile hamburger →
 * full-height drawer that carries the nav, language, dark mode and sign in.
 */
@Component({
  selector: 'mh-public-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    Logo,
    LanguageSwitcher,
    Hex,
    LineIcon,
    CtaPair,
    SwipeDismissDirective,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  host: {
    '(window:scroll)': 'onScroll()',
    '(window:resize)': 'onResize()',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class PublicHeaderComponent {
  private readonly _themeService = inject(ThemeService);
  private readonly _mobileMenuService = inject(MobileMenuService);
  private readonly _document = inject(DOCUMENT);
  private readonly _injector = inject(Injector);

  private readonly _burgerButton = viewChild<ElementRef<HTMLButtonElement>>('burgerButton');
  private readonly _closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly _drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  readonly isDark = this._themeService.isDark;
  readonly scrolled = signal(false);

  readonly features = FEATURES;
  readonly menuFeatures = MENU_FEATURES;
  readonly signupUrl = SIGNUP_URL;

  /** Desktop overlays. */
  readonly megaOpen = signal(false);
  readonly toolsOpen = signal(false);
  /** Feature whose preview shows in the mega-menu's right pane. */
  readonly activeFeature = signal<MarketingFeature>(FEATURES[0]);

  /** Mobile drawer (state shared so the sticky CTA can step aside). */
  readonly mobileOpen = this._mobileMenuService.isOpen;
  /** Features starts expanded: the short list fits on screen. */
  readonly mobileFeaturesOpen = signal(true);
  /** Stagger slot of the first row after the Features block (see `--i` in the SCSS). */
  readonly staggerAfterFeatures = computed(() =>
    this.mobileFeaturesOpen() ? this.menuFeatures.length + 1 : 1,
  );

  readonly switchLightLabel = $localize`:@@header.switchLight:Switch to light mode`;
  readonly switchDarkLabel = $localize`:@@header.switchDark:Switch to dark mode`;

  onScroll(): void {
    this.scrolled.set(window.scrollY > 5);
  }

  onResize(): void {
    if (window.innerWidth >= 1024 && this.mobileOpen()) this.closeMobile();
  }

  onEscape(): void {
    if (this.mobileOpen()) this.closeMobile();
  }

  toggleTheme(): void {
    this._themeService.toggle();
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

  openMobile(): void {
    // Set by index.html when the button was tapped before the app was ready.
    this._burgerButton()?.nativeElement.classList.remove('is-waking');
    this.mobileOpen.set(true);
    this._lockScroll();
    // The drawer stays `inert` until this render lands, so focus it after.
    afterNextRender(() => this._closeButton()?.nativeElement.focus(), {
      injector: this._injector,
    });
  }
  closeMobile(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    this.mobileFeaturesOpen.set(true);
    this._unlockScroll();
    this._burgerButton()?.nativeElement.focus({ preventScroll: true });
  }

  /** Keeps Tab and Shift+Tab inside the open drawer. */
  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = this._focusableInDrawer();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this._document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
  toggleMobileFeatures(): void {
    this.mobileFeaturesOpen.update((o) => !o);
  }

  private _focusableInDrawer(): HTMLElement[] {
    const drawer = this._drawer()?.nativeElement;
    if (!drawer) return [];
    return Array.from(
      drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.getClientRects().length > 0);
  }

  /**
   * Stops the page scrolling behind the drawer without moving it. Where the
   * browser shows a classic scrollbar, its width is padded back so nothing
   * shifts sideways.
   */
  private _lockScroll(): void {
    const body = this._document.body;
    const scrollbar = window.innerWidth - this._document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    body.style.overflow = 'hidden';
  }
  private _unlockScroll(): void {
    const body = this._document.body;
    body.style.overflow = '';
    body.style.paddingRight = '';
  }
}
