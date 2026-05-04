import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Message } from 'primeng/message';
import { GroupDetailContext } from '../../group-detail.context';

@Component({
  selector: 'mh-group-owner-actions-card',
  imports: [Button, CardModule, Message],
  templateUrl: './group-owner-actions-card.html',
  styleUrl: './group-owner-actions-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupOwnerActionsCard {
  readonly context = inject(GroupDetailContext);

  readonly editRequested = output<void>();

  readonly hasActiveLink = this.context.hasActiveJoinToken;
  readonly generating = this.context.generatingLink;

  readonly hint = computed(() => {
    if (this.context.totalMembers() <= 1) {
      return 'Send the join link to your clients to grow the group.';
    }
    return null;
  });

  onAddMembers(): void {
    this.context.openAddMembersDialog();
  }

  onJoinLink(): void {
    if (this.hasActiveLink()) {
      this.context.copyJoinLink();
    } else {
      this.context.generateJoinLink();
    }
  }

  onEditGroup(): void {
    this.editRequested.emit();
  }
}
