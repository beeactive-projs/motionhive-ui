import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { ErrorDialogService } from 'core';

@Component({
  selector: 'bee-error-dialog',
  imports: [DialogModule, ButtonModule],
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorDialog {
  private readonly _errorDialogService = inject(ErrorDialogService);

  protected readonly visible = this._errorDialogService.isOpen;
  protected readonly error = this._errorDialogService.error;

  protected readonly iconClass = computed(() => {
    const status = this.error()?.status ?? 0;
    if (status === 0) return 'pi pi-wifi';
    if (status === 403) return 'pi pi-lock';
    if (status === 404) return 'pi pi-search';
    if (status >= 500) return 'pi pi-server';
    return 'pi pi-exclamation-triangle';
  });

  protected close(): void {
    this._errorDialogService.close();
  }
}
