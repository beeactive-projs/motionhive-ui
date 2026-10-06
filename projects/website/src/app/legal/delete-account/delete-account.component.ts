import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'mh-delete-account',
  imports: [DatePipe, RouterLink, ButtonDirective],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountComponent {
  readonly lastUpdated = signal(new Date(2026, 9, 6));

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
