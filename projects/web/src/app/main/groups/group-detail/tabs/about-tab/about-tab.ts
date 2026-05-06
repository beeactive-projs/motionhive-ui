import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Group, JoinPolicies, TagSeverity } from 'core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { GroupDetailContext } from '../../group-detail.context';

/**
 * Subset of `Group` the About card renders. Both the full `Group` (member
 * view) and the trimmed public profile satisfy this shape.
 */
export type AboutTabGroup = Pick<
  Group,
  | 'joinPolicy'
  | 'description'
  | 'memberCount'
  | 'createdAt'
  | 'tags'
  | 'contactEmail'
  | 'contactPhone'
  | 'address'
  | 'city'
  | 'country'
> & {
  isPublic?: boolean;
};

@Component({
  selector: 'mh-group-about-tab',
  imports: [DatePipe, Button, CardModule, DividerModule, TagModule],
  templateUrl: './about-tab.html',
  styleUrl: './about-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutTab {
  /** Optional context — only present inside the member-only group detail page. */
  readonly context = inject(GroupDetailContext, { optional: true });

  /** Override the group from context. Used by the public preview view. */
  readonly group = input<AboutTabGroup | null>(null);

  /** Hide the visibility tag (the preview is always-public, the field isn't returned). */
  readonly showVisibility = input(true);

  readonly currentGroup = computed<AboutTabGroup | null>(
    () => this.group() ?? this.context?.group() ?? null,
  );

  readonly canManageJoinLink = computed(() => !!this.context?.isOwner());

  readonly joinPolicyLabel = computed(() => {
    const policy = this.currentGroup()?.joinPolicy;
    if (policy === JoinPolicies.Open) return 'Open';
    if (policy === JoinPolicies.Approval) return 'Approval required';
    return 'Invite only';
  });

  readonly joinPolicySeverity = computed<TagSeverity>(() => {
    const policy = this.currentGroup()?.joinPolicy;
    if (policy === JoinPolicies.Open) return TagSeverity.Success;
    if (policy === JoinPolicies.Approval) return TagSeverity.Warn;
    return TagSeverity.Info;
  });

  readonly locationDisplay = computed(() => {
    const g = this.currentGroup();
    if (!g) return '';
    return [g.address, g.city, g.country].filter((x): x is string => !!x).join(', ');
  });
}
