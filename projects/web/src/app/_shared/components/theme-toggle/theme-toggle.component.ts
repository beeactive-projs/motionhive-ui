import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { ThemeService } from 'core';

@Component({
  selector: 'mh-theme-toggle',
  imports: [ButtonDirective, TranslatePipe],
  template: `
    <button pButton
      type="button"
      rounded
      outlined
      size="small"
      (click)="toggle()"
      [attr.aria-label]="(isDark() ? 'components.themeToggle.switchToLight' : 'components.themeToggle.switchToDark') | translate"
      iconOnly
    >
      <i [class]="isDark() ? 'pi pi-sun' : 'pi pi-moon'"></i>
    </button>
  `,
})
export class ThemeToggleComponent {
  private readonly _themeService = inject(ThemeService);
  protected readonly isDark = this._themeService.isDark;

  protected toggle(): void {
    this._themeService.toggle();
  }
}
