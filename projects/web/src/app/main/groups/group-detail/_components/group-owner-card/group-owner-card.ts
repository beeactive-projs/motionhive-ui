import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Group } from 'core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

@Component({
  selector: 'mh-group-owner-card',
  imports: [HexAvatar, Button, CardModule],
  templateUrl: './group-owner-card.html',
  styleUrl: './group-owner-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupOwnerCard {
  readonly group = input.required<Group>();

  readonly ownerName = computed(() => {
    const i = this.group().instructor;
    if (!i) return 'Group owner';
    return `${i.firstName} ${i.lastName}`.trim() || 'Group owner';
  });

  readonly ownerEmail = computed(() => this.group().instructor?.email ?? null);

  readonly ownerInitials = computed(() => {
    const i = this.group().instructor;
    if (!i) return 'GO';
    return ((i.firstName?.charAt(0) ?? '') + (i.lastName?.charAt(0) ?? '')).toUpperCase() || 'GO';
  });
}
