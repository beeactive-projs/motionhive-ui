import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'mh-cookie-policy',
  imports: [DatePipe, RouterLink, ButtonDirective],
  templateUrl: './cookie-policy.component.html',
  styleUrl: './cookie-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiePolicyComponent {
  readonly lastUpdated = signal(new Date(2026, 5, 25));

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
