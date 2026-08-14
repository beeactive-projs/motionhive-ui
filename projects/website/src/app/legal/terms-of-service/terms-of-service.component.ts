import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'mh-terms-of-service',
  imports: [RouterLink, ButtonDirective],
  templateUrl: './terms-of-service.component.html',
  styleUrl: './terms-of-service.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfServiceComponent {
  readonly lastUpdated = signal('June 25, 2026');

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
