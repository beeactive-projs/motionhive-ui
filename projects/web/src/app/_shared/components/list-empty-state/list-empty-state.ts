import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Hex } from 'core';

@Component({
  selector: 'mh-list-empty-state',
  imports: [Button, Hex],
  templateUrl: './list-empty-state.html',
  styleUrl: './list-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListEmptyState {
  readonly icon = input<string>('pi pi-inbox');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly actionLabel = input<string>();
  readonly actionIcon = input<string>();
  readonly actionSeverity = input<'primary' | 'secondary' | 'success' | 'danger'>('primary');
  readonly actionOutlined = input<boolean>(false);
  readonly action = output<void>();
}
