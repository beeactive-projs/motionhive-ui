import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { Hex } from 'core';

@Component({
  selector: 'mh-groups-empty-state',
  imports: [Card, Button, Hex],
  templateUrl: './groups-empty-state.html',
  styleUrl: './groups-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsEmptyState {
  readonly variant = input<'manage' | 'discover'>('manage');
  readonly createGroup = output<void>();
}
