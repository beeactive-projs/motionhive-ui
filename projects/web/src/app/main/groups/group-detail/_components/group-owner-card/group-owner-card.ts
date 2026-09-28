import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Group } from 'core';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

@Component({
  selector: 'mh-group-owner-card',
  imports: [HexAvatar, ButtonDirective, CardModule, TranslatePipe],
  templateUrl: './group-owner-card.html',
  styleUrl: './group-owner-card.scss',
})
export class GroupOwnerCard {
  private readonly _translateService = inject(TranslateService);

  readonly group = input.required<Group>();

  readonly ownerName = computed(() => {
    const i = this.group().instructor;
    const fallback = this._translateService.instant('groups.ownerCard.fallbackName');
    if (!i) return fallback;
    return `${i.firstName} ${i.lastName}`.trim() || fallback;
  });

  readonly ownerEmail = computed(() => this.group().instructor?.email ?? null);

  readonly ownerInitials = computed(() => {
    const i = this.group().instructor;
    if (!i) return 'GO';
    return ((i.firstName?.charAt(0) ?? '') + (i.lastName?.charAt(0) ?? '')).toUpperCase() || 'GO';
  });
}
