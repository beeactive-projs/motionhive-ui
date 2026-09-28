import { Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { SelectButton } from 'primeng/selectbutton';
import {
  AppLanguage,
  AuthStore,
  AuthService,
  BillingCountsStore,
  FeedbackService,
  LanguageService,
} from 'core';
import { Avatar } from '../avatar/avatar';

interface AccountMenuItem {
  label: string;
  icon: string;
  routerLink: string[];
  queryParams?: Record<string, string>;
  hint?: string;
}

interface AccountMenuGroup {
  label: string;
  items: AccountMenuItem[];
}

@Component({
  selector: 'mh-profile-menu',
  imports: [
    RouterLink,
    FormsModule,
    Avatar,
    ButtonDirective,
    PopoverModule,
    DividerModule,
    SelectButton,
    TranslatePipe,
  ],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
})
export class ProfileMenu {
  private readonly _authStore = inject(AuthStore);
  private readonly _authService = inject(AuthService);
  private readonly _billingCounts = inject(BillingCountsStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);
  private readonly _languageService = inject(LanguageService);
  private readonly _translateService = inject(TranslateService);

  /** Each language named in itself — someone lost in the wrong one can still find theirs. */
  readonly languageOptions: SelectItem<AppLanguage>[] = this._languageService.languages.map(
    (language) => ({ value: language, label: this._translateService.instant(`language.${language}`) }),
  );
  readonly currentLanguage = this._languageService.current;

  constructor() {
    // The account menu lives in the persistent layout, so this fires
    // exactly once per session — the cached counts then feed both the
    // menu's Billing item and the profile Billing tab. No per-render hits.
    this._billingCounts.ensureLoaded();
  }

  /**
   * Account menu — the home for everything pulled out of the left rail in
   * the IA redesign (Model A): public profile, account, billing,
   * notifications, safety. Grouped with optional section labels. Labels and
   * hints are translation keys.
   */
  readonly accountGroups = computed(() => {
    const handle = this._authStore.user()?.handle;
    const groups: AccountMenuGroup[] = [];

    // Public profile — only meaningful once a handle is claimed.
    if (handle) {
      groups.push({
        label: '',
        items: [
          {
            label: 'shell.profileMenu.viewPublicProfile',
            icon: 'pi pi-compass',
            routerLink: ['/@' + handle],
            hint: 'shell.profileMenu.publicPageHint',
          },
        ],
      });
    }

    // Settings — each item lands on a real, always-present profile tab.
    // 'Account & profile' covers personal info + (for coaches) bio,
    // specialties, certifications and venues.
    const settings: AccountMenuItem[] = [
      {
        label: 'shell.profileMenu.accountAndProfile',
        icon: 'pi pi-user',
        routerLink: ['/profile'],
        queryParams: { tab: 'details' },
      },
    ];

    // Billing only appears once the user actually has an invoice or
    // membership — driven by the cached counts, no extra request.
    if (this._billingCounts.hasBilling()) {
      settings.push({
        label: 'shell.profileMenu.billing',
        icon: 'pi pi-credit-card',
        routerLink: ['/profile'],
        queryParams: { tab: 'billing' },
      });
    }

    settings.push(
      {
        label: 'nav.notifications',
        icon: 'pi pi-bell',
        routerLink: ['/profile'],
        queryParams: { tab: 'notifications' },
      },
      {
        label: 'shell.profileMenu.safety',
        icon: 'pi pi-shield',
        routerLink: ['/profile'],
        queryParams: { tab: 'safety' },
      },
    );

    groups.push({ label: 'nav.settings', items: settings });
    return groups;
  });

  private readonly _popover = viewChild.required<Popover>('popover');

  readonly user = this._authStore.user;
  readonly userName = this._authStore.userName;
  readonly isInstructor = this._authStore.isInstructor;

  readonly initials = computed(() => {
    const u = this._authStore.user();
    if (!u) return '';
    return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
  });

  toggle(event: Event): void {
    this._popover().toggle(event);
  }

  closeMenu(): void {
    this._popover().hide();
  }

  openFeedback(): void {
    this._popover().hide();
    this._feedbackService.open();
  }

  /** Reloads the page in the new language (see LanguageService). */
  setLanguage(language: AppLanguage): void {
    this._languageService.use(language);
  }

  signOut(): void {
    this.closeMenu();
    this._authService.logout().subscribe(() => {
      this._router.navigate(['/auth/login']);
    });
  }
}
