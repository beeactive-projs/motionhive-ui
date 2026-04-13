import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'mh-home',
  template: '<p>Home works</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {}
