import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AuthService,
  CurrencyRonPipe,
  MyProfile,
  Product,
  ProductService,
  TagSeverity,
  UserRoles,
  UserService,
  apiErrorMessage,
  countryNameFromCode,
  getProductBillingLabel,
  showApiError,
} from 'core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { EditInstructorProfile } from '../../_dialogs/edit-instructor-profile/edit-instructor-profile';
import { EditPersonalInfo } from '../../_dialogs/edit-personal-info/edit-personal-info';
import { BecomeInstructor } from '../../../user/_dialogs/become-instructor/become-instructor';
import { VenuesSection } from './venues-section/venues-section';

@Component({
  selector: 'mh-profile-details',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    CardModule,
    AvatarModule,
    TagModule,
    DividerModule,
    ButtonModule,
    ToastModule,
    TooltipModule,
    ToggleSwitch,
    CurrencyRonPipe,
    EditInstructorProfile,
    EditPersonalInfo,
    BecomeInstructor,
    VenuesSection,
  ],
  providers: [MessageService],
  templateUrl: './details.html',
  styleUrl: './details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Details implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _userService = inject(UserService);
  private readonly _authService = inject(AuthService);
  private readonly _messageService = inject(MessageService);

  readonly profile = input.required<MyProfile>();
  readonly refresh = output<void>();

  readonly showEditInstructor = signal(false);
  readonly showEditPersonalInfo = signal(false);
  readonly becomeInstructorVisible = signal(false);

  readonly coachingProducts = signal<Product[]>([]);
  readonly coachingProductsLoading = signal(false);
  private readonly _togglingProductIds = signal<Set<string>>(new Set());

  readonly uploadingAvatar = signal(false);
  readonly resendingVerification = signal(false);
  /** Optimistic avatar URL — wins over `profile().account.avatarUrl`
   *  between the successful upload response and the parent reloading
   *  the profile via (refresh). Null until the user uploads one. */
  readonly _pendingAvatarUrl = signal<string | null>(null);

  /** Human-readable rendering of the user's saved location. Falls back
   *  to an empty string when no location is set so the template can
   *  show its own "Not set" placeholder. */
  readonly locationDisplay = computed<string>(() => {
    const a = this.profile().account;
    const parts = [a.city, countryNameFromCode(a.countryCode)].filter(
      (x): x is string => !!x,
    );
    return parts.join(', ');
  });

  readonly fullName = computed(() => {
    const p = this.profile();
    return `${p.account.firstName} ${p.account.lastName}`;
  });

  readonly initials = computed(() => {
    const p = this.profile();
    return `${p.account.firstName.charAt(0)}${p.account.lastName.charAt(0)}`.toUpperCase();
  });

  /** Avatar URL to render — optimistic local value wins so the new
   *  picture is visible immediately after upload. */
  readonly avatarUrl = computed<string | null>(() => {
    return this._pendingAvatarUrl() ?? this.profile().account.avatarUrl ?? null;
  });

  readonly isInstructor = computed(() => {
    const p = this.profile();
    return p.roles.includes(UserRoles.Instructor);
  });

  readonly hasInstructorProfile = computed(
    () => this.profile().instructorProfile != null,
  );

  ngOnInit(): void {
    if (this.isInstructor()) {
      this.loadCoachingProducts();
    }
  }

  private loadCoachingProducts(): void {
    this.coachingProductsLoading.set(true);
    this._productService.list({ isActive: true, limit: 100 }).subscribe({
      next: (response) => {
        this.coachingProducts.set(response.items);
        this.coachingProductsLoading.set(false);
      },
      error: () => {
        this.coachingProductsLoading.set(false);
      },
    });
  }

  isToggling(productId: string): boolean {
    return this._togglingProductIds().has(productId);
  }

  toggleProductVisibility(product: Product, nextValue: boolean): void {
    // Optimistic: flip locally now, reconcile or revert on server reply.
    const previousValue = product.showOnProfile;
    this._patchLocalProduct(product.id, { showOnProfile: nextValue });

    const pending = new Set(this._togglingProductIds());
    pending.add(product.id);
    this._togglingProductIds.set(pending);

    this._productService.update(product.id, { showOnProfile: nextValue }).subscribe({
      next: (updated) => {
        this.coachingProducts.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p)),
        );
        this._clearToggling(product.id);
        this._messageService.add({
          severity: 'success',
          summary: nextValue ? 'Product visible' : 'Product hidden',
          detail: nextValue
            ? `"${product.name}" now shows on your public profile.`
            : `"${product.name}" is hidden from your public profile.`,
        });
      },
      error: (err: unknown) => {
        // Revert the optimistic flip.
        this._patchLocalProduct(product.id, { showOnProfile: previousValue });
        this._clearToggling(product.id);
        showApiError(
          this._messageService,
          'Error',
          'Failed to update visibility.',
          err,
        );
      },
    });
  }

  private _patchLocalProduct(id: string, patch: Partial<Product>): void {
    this.coachingProducts.update((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  private _clearToggling(productId: string): void {
    const next = new Set(this._togglingProductIds());
    next.delete(productId);
    this._togglingProductIds.set(next);
  }

  readonly billingLabel = getProductBillingLabel;

  /**
   * Curated identity pills shown in the profile header.
   *
   * - USER is filtered out: every account has it, surfacing it as a
   *   tag is noise and means nothing to the user.
   * - The remaining roles get user-friendly labels (e.g. INSTRUCTOR →
   *   "Coach") so the header doesn't leak our internal RBAC strings.
   * - We sort by importance: staff roles first (so an admin sees
   *   "Admin" prominently before any other identity), then the user's
   *   public-facing identity (Coach, Writer).
   *
   * Returned as a frozen list of `{label, severity}` so the template
   * stays trivial and doesn't repeat the lookup.
   */
  readonly displayBadges = computed<{ label: string; severity: TagSeverity }[]>(
    () => {
      const roles = new Set(this.profile().roles);
      const out: { label: string; severity: TagSeverity }[] = [];

      // Staff first — highest blast-radius identity, surface it on top
      // so the user is reminded they're operating in that capacity.
      if (roles.has(UserRoles.SuperAdmin)) {
        out.push({ label: 'Super admin', severity: TagSeverity.Danger });
      } else if (roles.has(UserRoles.Admin)) {
        out.push({ label: 'Admin', severity: TagSeverity.Warn });
      } else if (roles.has(UserRoles.Support)) {
        out.push({ label: 'Support', severity: TagSeverity.Contrast });
      }

      if (roles.has(UserRoles.Writer)) {
        out.push({ label: 'Writer', severity: TagSeverity.Info });
      }
      if (roles.has(UserRoles.Instructor)) {
        out.push({ label: 'Coach', severity: TagSeverity.Info });
      }

      return out;
    },
  );

  onInstructorSaved(): void {
    this.refresh.emit();
    this.loadCoachingProducts();
  }

  /**
   * Re-sends the email-verification link. Backend is rate-limited and
   * idempotent, so we surface any rejection as an info toast rather
   * than an error. The button disables itself while in flight to
   * prevent accidental double-clicks.
   */
  resendVerification(): void {
    if (this.resendingVerification()) return;
    const email = this.profile().account.email;
    this.resendingVerification.set(true);
    this._authService.resendVerification(email).subscribe({
      next: () => {
        this.resendingVerification.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Verification email sent',
          detail: `Check ${email}.`,
        });
      },
      error: (err: unknown) => {
        this.resendingVerification.set(false);
        this._messageService.add({
          severity: 'info',
          summary: 'Could not resend',
          detail: apiErrorMessage(
            err,
            'If the email is already verified or you recently asked, please try again later.',
          ),
        });
      },
    });
  }

  /**
   * File picker handler. Validates client-side (type + size) so we don't
   * round-trip obviously-bad files, then posts to the backend. The
   * response drives an optimistic avatar swap; `refresh.emit()` tells
   * the parent to reload the full profile so everything stays in sync.
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Reset the input so picking the same file twice still fires change.
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Wrong file type',
        detail: 'Pick a PNG, JPG or WEBP image.',
      });
      return;
    }
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      this._messageService.add({
        severity: 'warn',
        summary: 'File too large',
        detail: 'Profile pictures must be under 5 MB.',
      });
      return;
    }

    this.uploadingAvatar.set(true);
    this._userService.uploadAvatar(file).subscribe({
      next: ({ avatarUrl }) => {
        this._pendingAvatarUrl.set(avatarUrl);
        this.uploadingAvatar.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Profile picture updated',
        });
        this.refresh.emit();
      },
      error: (err: unknown) => {
        this.uploadingAvatar.set(false);
        showApiError(
          this._messageService,
          'Upload failed',
          'Could not upload the picture.',
          err,
        );
      },
    });
  }
}
