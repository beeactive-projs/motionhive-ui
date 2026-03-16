import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'bee-not-found',
  imports: [RouterLink, ButtonModule, ThemeToggleComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
