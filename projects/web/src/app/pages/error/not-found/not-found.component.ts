import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Logo } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-not-found',
  imports: [RouterLink, ButtonDirective, ThemeToggleComponent, Logo, TranslatePipe],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);

  goHome(): void {
    this._router.navigate(['/']);
  }

  goBack(): void {
    this._location.back();
  }
}
