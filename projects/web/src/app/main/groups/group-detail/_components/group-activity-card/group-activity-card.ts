import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Group, GroupMember, Post } from 'core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'mh-group-activity-card',
  imports: [DatePipe, CardModule],
  templateUrl: './group-activity-card.html',
  styleUrl: './group-activity-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupActivityCard {
  readonly group = input.required<Group>();
  readonly latestPost = input<Post | null>(null);
  readonly latestMember = input<GroupMember | null>(null);

  readonly latestPostAt = computed(() => this.latestPost()?.createdAt ?? null);
  readonly latestMemberAt = computed(() => this.latestMember()?.joinedAt ?? null);
}
