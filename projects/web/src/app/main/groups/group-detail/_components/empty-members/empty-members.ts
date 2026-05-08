import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';

@Component({
  selector: 'mh-empty-members',
  imports: [Button, Card, Divider],
  templateUrl: './empty-members.html',
  styleUrl: './empty-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyMembers {
  readonly generateLinkRequested = output<void>();
  readonly addManuallyRequested = output<void>();
}
