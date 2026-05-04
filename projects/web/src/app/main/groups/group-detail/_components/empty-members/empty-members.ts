import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';

@Component({
  selector: 'mh-empty-members',
  imports: [AvatarModule, Button],
  templateUrl: './empty-members.html',
  styleUrl: './empty-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyMembers {
  readonly generateLinkRequested = output<void>();
  readonly addManuallyRequested = output<void>();
}
