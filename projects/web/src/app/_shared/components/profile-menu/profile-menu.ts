import { Component, ChangeDetectionStrategy, computed, inject, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { AuthStore, AuthService, FeedbackService } from 'core';

@Component({
  selector: 'mh-profile-menu',
  imports: [RouterLink, AvatarModule, ButtonModule, PopoverModule, DividerModule],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenu {
  private readonly _authStore = inject(AuthStore);
  private readonly _authService = inject(AuthService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  readonly menuItems = computed(() => [
    { label: 'Profile', icon: 'pi pi-user', routerLink: 'profile' },
  ]);

  private readonly _popover = viewChild.required<Popover>('popover');

  readonly user = this._authStore.user;
  readonly userName = this._authStore.userName;

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

  signOut(): void {
    this.closeMenu();
    this._authService.logout().subscribe(() => {
      this._router.navigate(['/auth/login']);
    });
  }
}
