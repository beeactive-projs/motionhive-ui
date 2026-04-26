import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'mh-user-progress',
  template: '<p>Progress works</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress {}
