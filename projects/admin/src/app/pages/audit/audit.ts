import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { showApiError } from 'core';
import { AdminAuditService } from '../../_data/services/admin-audit.service';
import { DbRow } from '../../_data/models/admin.models';
import { getPath } from '../../_data/cell.util';

@Component({
  selector: 'mh-admin-audit',
  imports: [FormsModule, TableModule, InputTextModule, ButtonModule],
  templateUrl: './audit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Audit {
  private readonly _audit = inject(AdminAuditService);
  private readonly _messages = inject(MessageService);

  readonly rows = 30;
  readonly items = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  action = '';
  private page = 1;

  cell(row: DbRow, path: string): string {
    return getPath(row, path);
  }
  applyFilter(): void {
    this.page = 1;
    this.load();
  }
  onLazyLoad(e: TableLazyLoadEvent): void {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.rows;
    this.page = Math.floor(first / rows) + 1;
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this._audit.list(this.page, this.rows, this.action || undefined).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Audit', 'Failed to load audit log', err);
      },
    });
  }
}
