import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mh-cookie-policy',
  imports: [RouterLink, ButtonModule],
  templateUrl: './cookie-policy.component.html',
  styleUrl: './cookie-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiePolicyComponent {
  readonly lastUpdated = signal('June 25, 2026');

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
