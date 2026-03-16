import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../../_core/services/theme.service';

@Component({
  selector: 'bee-theme-toggle',
  imports: [ButtonModule],
  template: `
    <p-button
      [icon]="isDark() ? 'pi pi-sun' : 'pi pi-moon'"
      rounded
      outlined
      size="small"
      (onClick)="_themeService.toggle()"
      [ariaLabel]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly _themeService = inject(ThemeService);
  protected readonly isDark = this._themeService.isDark;
}
