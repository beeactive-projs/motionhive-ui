import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  ProductService,
  ProductTypes,
  TagSeverity,
  CurrencyRonPipe,
  type Product,
  type ProductType,
} from 'core';
import { ProductFormDialog } from '../../_dialogs/product-form-dialog/product-form-dialog';

@Component({
  selector: 'mh-products',
  imports: [
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    CurrencyRonPipe,
    ProductFormDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './products.html',
  styleUrl: './products.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  products = signal<Product[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);

  typeFilter = signal<ProductType | undefined>(undefined);
  readonly typeOptions = [
    { label: 'All', value: undefined },
    { label: 'One-off', value: ProductTypes.OneOff as ProductType },
    { label: 'Subscription', value: ProductTypes.Subscription as ProductType },
  ];

  showProductFormDialog = signal(false);
  editingProduct = signal<Product | null>(null);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this._productService
      .list({
        type: this.typeFilter(),
        page: this.currentPage(),
        limit: this.rows,
      })
      .subscribe({
        next: (response) => {
          this.products.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load products',
          });
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadProducts();
  }

  onTypeFilterChange(type: ProductType | undefined): void {
    this.typeFilter.set(type);
    this.currentPage.set(1);
    this.loadProducts();
  }

  openCreateDialog(): void {
    this.editingProduct.set(null);
    this.showProductFormDialog.set(true);
  }

  openEditDialog(product: Product): void {
    this.editingProduct.set(product);
    this.showProductFormDialog.set(true);
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
    this._productService.deactivate(product.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Product deactivated',
          detail: `"${product.name}" has been deactivated`,
        });
        this.loadProducts();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to deactivate product',
        });
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

  intervalLabel(product: Product): string {
    if (!product.interval) return '';
    const count = product.intervalCount ?? 1;
    const unit = product.interval;
    return count === 1 ? `/ ${unit}` : `/ ${count} ${unit}s`;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
