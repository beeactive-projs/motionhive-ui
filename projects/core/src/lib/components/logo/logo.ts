import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'mh-logo',
  templateUrl: './logo.html',
  styleUrl: './logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly styleClass = input<string>('max-w-10');
  /** `sm` tightens the gap and wordmark for compact bars (e.g. the mobile menu). */
  readonly size = input<'md' | 'sm'>('md');
}
