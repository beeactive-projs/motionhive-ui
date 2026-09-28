import { Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';

@Component({
  selector: 'mh-empty-members',
  imports: [ButtonDirective, Card, Divider, TranslatePipe],
  templateUrl: './empty-members.html',
  styleUrl: './empty-members.scss',
})
export class EmptyMembers {
  readonly generateLinkRequested = output<void>();
  readonly addManuallyRequested = output<void>();
}
