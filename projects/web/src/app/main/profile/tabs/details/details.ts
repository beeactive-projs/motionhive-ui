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
  CurrencyRonPipe,
  MyProfile,
  Product,
  ProductService,
  TagSeverity,
  UserRoles,
  getProductBillingLabel,
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
import { BecomeInstructor } from '../../../user/_dialogs/become-instructor/become-instructor';

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
    BecomeInstructor,
  ],
  providers: [MessageService],
  templateUrl: './details.html',
  styleUrl: './details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Details implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);

  readonly profile = input.required<MyProfile>();
  readonly refresh = output<void>();

  readonly showEditInstructor = signal(false);
  readonly becomeInstructorVisible = signal(false);

  readonly coachingProducts = signal<Product[]>([]);
  readonly coachingProductsLoading = signal(false);
  private readonly _togglingProductIds = signal<Set<string>>(new Set());

  readonly fullName = computed(() => {
    const p = this.profile();
    return `${p.account.firstName} ${p.account.lastName}`;
  });

  readonly initials = computed(() => {
    const p = this.profile();
    return `${p.account.firstName.charAt(0)}${p.account.lastName.charAt(0)}`.toUpperCase();
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
      error: (err) => {
        // Revert the optimistic flip.
        this._patchLocalProduct(product.id, { showOnProfile: previousValue });
        this._clearToggling(product.id);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Failed to update visibility.',
        });
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

  roleSeverity(role: string): TagSeverity {
    switch (role) {
      case UserRoles.SuperAdmin:
        return TagSeverity.Danger;
      case UserRoles.Admin:
        return TagSeverity.Warn;
      case UserRoles.Instructor:
        return TagSeverity.Info;
      case UserRoles.Support:
        return TagSeverity.Contrast;
      default:
        return TagSeverity.Secondary;
    }
  }

  onInstructorSaved(): void {
    this.refresh.emit();
    this.loadCoachingProducts();
  }
}
