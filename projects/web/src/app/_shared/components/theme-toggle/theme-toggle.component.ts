import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { ThemeService } from 'core';

@Component({
  selector: 'mh-theme-toggle',
  imports: [ButtonDirective],
  template: `
    <button pButton
      type="button"
      rounded
      outlined
      size="small"
      (click)="_themeService.toggle()"
      [attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      iconOnly
    >
      <i [class]="isDark() ? 'pi pi-sun' : 'pi pi-moon'"></i>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly _themeService = inject(ThemeService);
  protected readonly isDark = this._themeService.isDark;
}
