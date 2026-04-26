import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DataView } from 'primeng/dataview';
import {
  ProductService,
  ProductTypes,
  TagSeverity,
  CurrencyRonPipe,
  StatusLabelPipe,
  getProductBillingLabel,
  showApiError,
  type Product,
  type ProductType,
} from 'core';
import { catchError, of, startWith, Subject, switchMap, take } from 'rxjs';
import { ProductFormDialog } from '../../_dialogs/product-form-dialog/product-form-dialog';
import { ListCard } from '../../../../_shared/components/list-card/list-card';

@Component({
  selector: 'mh-products',
  imports: [
    FormsModule,
    Button,
    TableModule,
    Tag,
    SkeletonModule,
    ToastModule,
    ConfirmDialog,
    Tooltip,
    ToggleSwitch,
    CurrencyRonPipe,
    StatusLabelPipe,
    DataView,
    ProductFormDialog,
    ListCard,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './products.html',
  styleUrl: './products.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _scrollSentinel = viewChild<ElementRef>('scrollSentinel');
  private _observer?: IntersectionObserver;

  private readonly _reload$ = new Subject<void>();

  readonly products = signal<Product[]>([]);
  readonly totalRecords = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);

  readonly rows = 10;
  readonly currentPage = signal(1);

  readonly hasMore = computed(() => this.products().length < this.totalRecords());

  readonly typeFilter = signal<ProductType | undefined>(undefined);
  readonly typeOptions = [
    { label: 'All', value: undefined },
    { label: 'One-off', value: ProductTypes.OneOff as ProductType },
    { label: 'Subscription', value: ProductTypes.Subscription as ProductType },
  ];

  readonly showProductFormDialog = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly togglingProfileIds = signal<Set<string>>(new Set());

  constructor() {
    this._reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          return this._productService
            .list({
              type: this.typeFilter(),
              page: this.currentPage(),
              limit: this.rows,
            })
            .pipe(
              catchError((err) => {
                showApiError(this._messageService, 'Error', 'Failed to load products', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        if (response) {
          this.products.set(response.items);
          this.totalRecords.set(response.total);
        }
        this.loading.set(false);
        this.loadingMore.set(false);
      });

    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  reload(): void {
    this._reload$.next();
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this._productService
      .list({
        type: this.typeFilter(),
        page: this.currentPage() + 1,
        limit: this.rows,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.products.update((list) => [...list, ...response.items]);
          this.totalRecords.set(response.total);
          this.currentPage.update((p) => p + 1);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loadingMore.set(false);
          showApiError(this._messageService, 'Error', 'Failed to load more products', err);
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.reload();
  }

  onTypeFilterChange(type: ProductType | undefined): void {
    this.typeFilter.set(type);
    this.currentPage.set(1);
    this.reload();
  }

  openCreateDialog(): void {
    this.editingProduct.set(null);
    this.showProductFormDialog.set(true);
  }

  openEditDialog(product: Product): void {
    this.editingProduct.set(product);
    this.showProductFormDialog.set(true);
  }

  toggleShowOnProfile(product: Product, nextValue: boolean): void {
    const previousValue = product.showOnProfile;
    this._patchLocalProduct(product.id, { showOnProfile: nextValue });

    const pending = new Set(this.togglingProfileIds());
    pending.add(product.id);
    this.togglingProfileIds.set(pending);

    this._productService
      .update(product.id, { showOnProfile: nextValue })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.products.update((list) =>
            list.map((p) => (p.id === updated.id ? updated : p)),
          );
          this._clearTogglingProfileId(product.id);
          this._messageService.add({
            severity: 'success',
            summary: nextValue ? 'Showing on profile' : 'Hidden from profile',
            detail: nextValue
              ? `"${product.name}" now shows on your public profile.`
              : `"${product.name}" is hidden from your public profile.`,
          });
        },
        error: (err) => {
          this._patchLocalProduct(product.id, { showOnProfile: previousValue });
          this._clearTogglingProfileId(product.id);
          showApiError(this._messageService, 'Error', 'Failed to update visibility', err);
        },
      });
  }

  private _patchLocalProduct(id: string, patch: Partial<Product>): void {
    this.products.update((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  private _clearTogglingProfileId(productId: string): void {
    const next = new Set(this.togglingProfileIds());
    next.delete(productId);
    this.togglingProfileIds.set(next);
  }

  confirmDeactivate(product: Product): void {
    this._confirmationService.confirm({
      message: `Are you sure you want to deactivate "${product.name}"? It will no longer appear in product lists.`,
      header: 'Deactivate product',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivateProduct(product),
    });
  }

  private deactivateProduct(product: Product): void {
    this._productService
      .deactivate(product.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'Product deactivated',
            detail: `"${product.name}" has been deactivated`,
          });
          this.reload();
        },
        error: (err) => {
          showApiError(this._messageService, 'Error', 'Failed to deactivate product', err);
        },
      });
  }

  typeSeverity(type: ProductType): TagSeverity {
    return type === ProductTypes.Subscription ? TagSeverity.Info : TagSeverity.Secondary;
  }

  typeLabel(type: ProductType): string {
    return type === ProductTypes.Subscription ? 'Subscription' : 'One-off';
  }

  activeSeverity(isActive: boolean): TagSeverity {
    return isActive ? TagSeverity.Success : TagSeverity.Danger;
  }

  readonly billingLabel = getProductBillingLabel;

  productIcon(product: Product): string {
    return product.type === ProductTypes.Subscription ? 'pi pi-sync' : 'pi pi-box';
  }

  subtitleFor(product: Product): string {
    return product.interval ? this.billingLabel(product) : 'One-off product';
  }

  cardAccent(product: Product): 'none' | 'primary' | 'danger' | 'success' {
    if (!product.isActive) return 'danger';
    if (product.showOnProfile) return 'primary';
    return 'none';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
