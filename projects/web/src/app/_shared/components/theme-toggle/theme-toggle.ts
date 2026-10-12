import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { ThemeService } from 'core';

@Component({
  selector: 'mh-theme-toggle',
  imports: [ButtonDirective, TranslatePipe],
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  private readonly _themeService = inject(ThemeService);
  protected readonly isDark = this._themeService.isDark;

  /** false = a borderless icon button, as in the marketing site's header. */
  readonly outlined = input(true);

  protected toggle(): void {
    this._themeService.toggle();
  }
}
