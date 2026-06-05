import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { showApiError } from 'core';
import { AdminDbService } from '../../_data/services/admin-db.service';
import { DbRow, DbTableInfo } from '../../_data/models/admin.models';

@Component({
  selector: 'mh-admin-database',
  imports: [FormsModule, TableModule, SelectModule],
  templateUrl: './database.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Database {
  private readonly _db = inject(AdminDbService);
  private readonly _messages = inject(MessageService);

  readonly rows = 25;
  readonly tables = signal<DbTableInfo[]>([]);
  readonly selectedTable = signal<string | null>(null);
  readonly columns = signal<string[]>([]);
  readonly data = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  private currentPage = 1;

  // Bound to the select.
  table: string | null = null;

  constructor() {
    this._db.tables().subscribe({
      next: (res) => this.tables.set(res.tables),
      error: (err) => showApiError(this._messages, 'Database', 'Failed to load tables', err),
    });
  }

  onTableChange(): void {
    this.selectedTable.set(this.table);
    this.currentPage = 1;
    this.columns.set([]);
    this.data.set([]);
    this.total.set(0);
    if (this.table) this.load();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage = Math.floor(first / rows) + 1;
    if (this.table) this.load();
  }

  /** Stringify any cell value for display (objects → JSON). */
  cell(row: DbRow, col: string): string {
    const v = row[col];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  private load(): void {
    const table = this.table;
    if (!table) return;
    this.loading.set(true);
    this._db.rows(table, this.currentPage, this.rows).subscribe({
      next: (res) => {
        this.data.set(res.items);
        this.total.set(res.total);
        if (res.items.length && this.columns().length === 0) {
          this.columns.set(Object.keys(res.items[0]));
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Database', 'Failed to load rows', err);
      },
    });
  }
}
