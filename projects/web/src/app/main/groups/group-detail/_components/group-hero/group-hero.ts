import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Group, JoinPolicies, TagSeverity } from 'core';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'mh-group-hero',
  imports: [AvatarModule, BreadcrumbModule, TagModule, Card],
  templateUrl: './group-hero.html',
  styleUrl: './group-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupHero {
  readonly group = input.required<Group>();
  readonly membersCount = input<number | null>(null);

  readonly breadcrumbItems = computed<MenuItem[]>(() => [
    { label: 'Groups', routerLink: '/groups/your-groups' },
    { label: this.group().name },
  ]);

  readonly JoinPolicies = JoinPolicies;

  readonly joinPolicyLabel = computed(() => {
    const policy = this.group().joinPolicy;
    if (policy === JoinPolicies.Open) return 'Open';
    if (policy === JoinPolicies.Approval) return 'Approval required';
    return 'Invite only';
  });

  readonly joinPolicySeverity = computed<TagSeverity>(() => {
    const policy = this.group().joinPolicy;
    if (policy === JoinPolicies.Open) return TagSeverity.Success;
    if (policy === JoinPolicies.Approval) return TagSeverity.Warn;
    return TagSeverity.Info;
  });

  readonly memberCountLabel = computed(() => {
    const n = this.membersCount() || 0;
    return `${n} ${n === 1 ? 'member' : 'members'}`;
  });

  readonly visibilityLabel = computed(() => (this.group().isPublic ? 'Public' : 'Private'));

  readonly avatarLabel = computed(() => {
    const name = this.group().name ?? '0';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'G';
  });
}
