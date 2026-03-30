import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'mh-logo',
  templateUrl: './logo.html',
  styleUrl: './logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly styleClass = input<string>('max-w-10');
}
