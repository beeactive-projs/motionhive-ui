import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';

@Component({
  selector: 'mh-empty-members',
  imports: [ButtonDirective, Card, Divider],
  templateUrl: './empty-members.html',
  styleUrl: './empty-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyMembers {
  readonly generateLinkRequested = output<void>();
  readonly addManuallyRequested = output<void>();
}
