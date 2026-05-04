import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { JoinPolicies, TagSeverity } from 'core';
import { Button } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { GroupDetailContext } from '../../group-detail.context';

@Component({
  selector: 'mh-group-about-tab',
  imports: [DatePipe, Button, TagModule],
  templateUrl: './about-tab.html',
  styleUrl: './about-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutTab {
  readonly context = inject(GroupDetailContext);

  readonly joinPolicyLabel = computed(() => {
    const policy = this.context.group()?.joinPolicy;
    if (policy === JoinPolicies.Open) return 'Open';
    if (policy === JoinPolicies.Approval) return 'Approval required';
    return 'Invite only';
  });

  readonly joinPolicySeverity = computed<TagSeverity>(() => {
    const policy = this.context.group()?.joinPolicy;
    if (policy === JoinPolicies.Open) return TagSeverity.Success;
    if (policy === JoinPolicies.Approval) return TagSeverity.Warn;
    return TagSeverity.Info;
  });
}
