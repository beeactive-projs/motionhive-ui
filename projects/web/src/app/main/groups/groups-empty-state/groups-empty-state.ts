import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Card } from 'primeng/card';
import { ButtonDirective } from 'primeng/button';
import { Hex } from 'core';

@Component({
  selector: 'mh-groups-empty-state',
  imports: [Card, ButtonDirective, Hex, TranslatePipe],
  templateUrl: './groups-empty-state.html',
  styleUrl: './groups-empty-state.scss',
})
export class GroupsEmptyState {
  readonly variant = input<'manage' | 'discover'>('manage');
  readonly createGroup = output<void>();
}
