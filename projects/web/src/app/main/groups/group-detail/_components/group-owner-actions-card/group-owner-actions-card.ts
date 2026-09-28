import { Component, computed, inject, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Message } from 'primeng/message';
import { GroupDetailContext } from '../../group-detail.context';

@Component({
  selector: 'mh-group-owner-actions-card',
  imports: [ButtonDirective, CardModule, Message, TranslatePipe],
  templateUrl: './group-owner-actions-card.html',
  styleUrl: './group-owner-actions-card.scss',
})
export class GroupOwnerActionsCard {
  readonly context = inject(GroupDetailContext);

  readonly editRequested = output<void>();

  readonly hasActiveLink = this.context.hasActiveJoinToken;
  readonly generating = this.context.generatingLink;

  /** Translation key for the onboarding hint, or null. */
  readonly hint = computed(() => {
    if (this.context.totalMembers() <= 1) {
      return 'groups.ownerActions.hint';
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
