import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'mh-core',
  imports: [],
  template: ` <p>core works!</p> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ``,
})
export class Core {}
