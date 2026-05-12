import {
  ChangeDetectionStrategy,
  Component,
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
  getProductBillingLabel,
  showApiError,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { EditInstructorProfile } from '../../../../_dialogs/edit-instructor-profile/edit-instructor-profile';
import { VenuesSection } from '../../venues-section/venues-section';

/**
 * Coaching profile card — mounted only when the user is an instructor.
 * Owns its own "Edit coaching profile" dialog instance and the
 * coaching-products list (with optimistic show-on-profile toggle).
 * Emits `refresh` after any save so the parent reloads `MyProfile`.
 */
@Component({
  selector: 'mh-coaching-card',
  imports: [
    FormsModule,
    RouterLink,
    Card,
    Divider,
    Button,
    TagModule,
    TooltipModule,
    ToggleSwitch,
    CurrencyRonPipe,
    EditInstructorProfile,
    VenuesSection,
  ],
  providers: [MessageService],
  templateUrl: './coaching-card.html',
  styleUrl: './coaching-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachingCard implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);

  readonly profile = input.required<MyProfile>();
  readonly refresh = output<void>();

  readonly showEditInstructor = signal(false);

  readonly coachingProducts = signal<Product[]>([]);
  readonly coachingProductsLoading = signal(false);
  private readonly _togglingProductIds = signal<Set<string>>(new Set());

  readonly billingLabel = getProductBillingLabel;

  ngOnInit(): void {
    this.loadCoachingProducts();
  }

  isToggling(productId: string): boolean {
    return this._togglingProductIds().has(productId);
  }

  /**
   * Optimistic flip with revert-on-error. Mirrors the pattern used
   * throughout the app: update the local copy now, fire the PATCH,
   * adopt the server response or revert + toast.
   */
  toggleProductVisibility(product: Product, nextValue: boolean): void {
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

  onInstructorSaved(): void {
    this.refresh.emit();
    this.loadCoachingProducts();
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
}
