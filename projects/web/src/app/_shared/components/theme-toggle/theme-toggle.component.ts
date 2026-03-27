import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { ThemeService } from 'core';

@Component({
  selector: 'mh-theme-toggle',
  imports: [Button],
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
