import { computed, Injectable, signal } from '@angular/core';

export interface HttpErrorInfo {
  status: number;
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorDialogService {
  private readonly _error = signal<HttpErrorInfo | null>(null);

  readonly error = this._error.asReadonly();
  readonly isOpen = computed(() => this._error() !== null);

  show(error: HttpErrorInfo): void {
    this._error.set(error);
  }

  close(): void {
    this._error.set(null);
  }
}
