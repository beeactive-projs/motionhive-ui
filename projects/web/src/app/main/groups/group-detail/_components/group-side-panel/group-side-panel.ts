import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { GroupDetailContext } from '../../group-detail.context';
import { GroupOwnerCard } from '../group-owner-card/group-owner-card';
import { GroupTagsCard } from '../group-tags-card/group-tags-card';
import { GroupOwnerActionsCard } from '../group-owner-actions-card/group-owner-actions-card';
import { GroupActivityCard } from '../group-activity-card/group-activity-card';

@Component({
  selector: 'mh-group-side-panel',
  imports: [GroupOwnerCard, GroupTagsCard, GroupOwnerActionsCard, GroupActivityCard],
  templateUrl: './group-side-panel.html',
  styleUrl: './group-side-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSidePanel {
  readonly context = inject(GroupDetailContext);

  readonly editRequested = output<void>();

  readonly group = this.context.group;
  readonly isOwner = this.context.isOwner;

  readonly hasTags = computed(() => (this.group()?.tags?.length ?? 0) > 0);
}
