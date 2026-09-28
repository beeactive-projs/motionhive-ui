import {
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
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
  CurrencyRonPipe,
  type Product,
  ProductService,
  type ProductType,
  ProductTypes,
  escapeHtml,
  showApiError,
  StatusLabelPipe,
  TagSeverity,
} from 'core';
import { catchError, of, startWith, Subject, switchMap, take } from 'rxjs';
import { ProductFormDialog } from '../../_dialogs/product-form-dialog/product-form-dialog';
import { ListCard } from '../../../../_shared/components/list-card/list-card';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { productBillingLabel } from '../shared/payment-labels';

@Component({
  selector: 'mh-products',
  imports: [
    FormsModule,
    ButtonDirective,
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
    ListEmptyState,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);
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
  readonly typeOptions: { label: string; value: ProductType | undefined }[] = [
    { label: this._translateService.instant('common.all'), value: undefined },
    { label: this.typeLabel(ProductTypes.OneOff), value: ProductTypes.OneOff },
    { label: this.typeLabel(ProductTypes.Subscription), value: ProductTypes.Subscription },
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
                showApiError(
                  this._messageService,
                  this._translateService.instant('toast.summary.error'),
                  this._translateService.instant('payments.products.toast.loadFailed'),
                  err,
                );
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
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('payments.products.toast.loadMoreFailed'),
            err,
          );
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
          const toast = nextValue ? 'shown' : 'hidden';
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant(`payments.products.toast.${toast}.summary`),
            detail: this._translateService.instant(`payments.products.toast.${toast}.detail`, {
              name: product.name,
            }),
          });
        },
        error: (err) => {
          this._patchLocalProduct(product.id, { showOnProfile: previousValue });
          this._clearTogglingProfileId(product.id);
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('payments.products.toast.visibilityFailed'),
            err,
          );
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
      message: this._translateService.instant('payments.products.confirm.deactivate.message', {
        name: escapeHtml(product.name),
      }),
      header: this._translateService.instant('payments.products.confirm.deactivate.header'),
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
            summary: this._translateService.instant('payments.products.toast.deactivated.summary'),
            detail: this._translateService.instant('payments.products.toast.deactivated.detail', {
              name: product.name,
            }),
          });
          this.reload();
        },
        error: (err) => {
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('payments.products.toast.deactivateFailed'),
            err,
          );
        },
      });
  }

  typeSeverity(type: ProductType): TagSeverity {
    return type === ProductTypes.Subscription ? TagSeverity.Info : TagSeverity.Secondary;
  }

  typeLabel(type: ProductType): string {
    return this._translateService.instant(`payments.productType.${type}`);
  }

  activeLabel(isActive: boolean): string {
    return this._translateService.instant(
      isActive ? 'payments.products.state.active' : 'payments.products.state.inactive',
    );
  }

  activeSeverity(isActive: boolean): TagSeverity {
    return isActive ? TagSeverity.Success : TagSeverity.Danger;
  }

  readonly billingLabel = productBillingLabel;

  productIcon(product: Product): string {
    return product.type === ProductTypes.Subscription ? 'pi pi-sync' : 'pi pi-box';
  }

  subtitleFor(product: Product): string {
    return product.interval
      ? this.billingLabel(product)
      : this._translateService.instant('payments.products.oneOffProduct');
  }

  cardAccent(product: Product): 'none' | 'primary' | 'danger' | 'success' {
    if (!product.isActive) return 'danger';
    if (product.showOnProfile) return 'primary';
    return 'none';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
