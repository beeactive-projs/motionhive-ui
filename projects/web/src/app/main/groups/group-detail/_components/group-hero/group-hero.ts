import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Group, Hex, JoinPolicies, TagSeverity } from 'core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonDirective } from 'primeng/button';
import { GroupDetailContext } from '../../group-detail.context';

@Component({
  selector: 'mh-group-hero',
  imports: [Hex, BreadcrumbModule, TagModule, Card, ButtonDirective, TranslatePipe],
  templateUrl: './group-hero.html',
  styleUrl: './group-hero.scss',
})
export class GroupHero {
  private readonly _context = inject(GroupDetailContext);
  private readonly _translateService = inject(TranslateService);

  readonly group = input.required<Group>();
  readonly membersCount = input<number | null>(null);

  readonly canLeave = this._context.canLeave;

  readonly breadcrumbItems = computed<MenuItem[]>(() => [
    { label: this._translateService.instant('nav.groups'), routerLink: '/groups/your-groups' },
    { label: this.group().name },
  ]);

  readonly JoinPolicies = JoinPolicies;

  /** Translation key for the join-policy tag ("Approval required" wording). */
  readonly joinPolicyLabelKey = computed(() => `groups.joinPolicyLong.${this.group().joinPolicy}`);

  readonly joinPolicySeverity = computed<TagSeverity>(() => {
    const policy = this.group().joinPolicy;
    if (policy === JoinPolicies.Open) return TagSeverity.Success;
    if (policy === JoinPolicies.Approval) return TagSeverity.Warn;
    return TagSeverity.Info;
  });

  readonly memberCountLabel = computed(() =>
    this._translateService.instant('count.members', { count: this.membersCount() || 0 }),
  );

  readonly visibilityLabel = computed(() =>
    this._translateService.instant(
      this.group().isPublic ? 'groups.visibility.public' : 'groups.visibility.private',
    ),
  );

  readonly avatarLabel = computed(() => {
    const name = this.group().name ?? '0';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'G';
  });

  onLeaveGroup(): void {
    this._context.leaveGroup();
  }
}
