import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Avatar } from 'primeng/avatar';
import { AvatarGroup } from 'primeng/avatargroup';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';
import { Group, JoinPolicies, joinPolicyLabel, joinPolicySeverity, TagSeverity } from 'core';
import { paletteFor, monogramFromName } from '../_utils/group-palette.util';

@Component({
  selector: 'mh-group-card',
  imports: [RouterLink, Card, Avatar, AvatarGroup, Tag, Button, Menu, Tooltip],
  templateUrl: './group-card.html',
  styleUrl: './group-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCard {
  readonly group = input.required<Group>();
  readonly mode = input<'manage' | 'discover'>('manage');
  readonly isBusy = input<boolean>(false);
  readonly joinRequestStatus = input<string | null>(null);

  readonly action = output<{ kind: 'invite' | 'edit' | 'share' | 'delete'; group: Group }>();
  readonly discoverAction = output<{ kind: 'join' | 'cancel'; group: Group }>();

  readonly JoinPolicies = JoinPolicies;

  private readonly _menu = viewChild<Menu>('menu');

  private static readonly AV_TONES = ['amber', 'emerald', 'rose', 'sky', 'violet'] as const;

  readonly menuItems: MenuItem[] = [
    {
      label: 'Invite members',
      icon: 'pi pi-user-plus',
      command: () => this.action.emit({ kind: 'invite', group: this.group() }),
    },
    {
      label: 'Edit group',
      icon: 'pi pi-pencil',
      command: () => this.action.emit({ kind: 'edit', group: this.group() }),
    },
    {
      label: 'Copy invite link',
      icon: 'pi pi-link',
      command: () => this.action.emit({ kind: 'share', group: this.group() }),
    },
    // {
    //   label: 'Archive',
    //   icon: 'pi pi-inbox',
    //   command: () => this.action.emit({ kind: 'archive', group: this.group() }),
    // },
    { separator: true },
    {
      label: 'Delete group',
      icon: 'pi pi-trash',
      styleClass: 'gp-menu-danger',
      command: () => this.action.emit({ kind: 'delete', group: this.group() }),
    },
  ];

  get cardLink(): string[] {
    return this.mode() === 'discover'
      ? ['/groups/preview', this.group().id]
      : ['/groups', this.group().id];
  }

  get monogram(): string {
    return monogramFromName(this.group().name);
  }

  get avatarStyle(): Record<string, string> | null {
    if (this.group().logoUrl) return null;
    const palette = paletteFor(this.group().id);
    return {
      background: `linear-gradient(155deg, var(--p-${palette}-400), var(--p-${palette}-600))`,
      color: `var(--p-${palette}-50)`,
      fontWeight: '700',
    };
  }

  get policyLabel(): string {
    return joinPolicyLabel(this.group().joinPolicy);
  }

  get policySeverity(): TagSeverity {
    return joinPolicySeverity(this.group().joinPolicy);
  }

  get policyTooltip(): string {
    switch (this.group().joinPolicy) {
      case JoinPolicies.Open:
        return 'Anyone with the link can join';
      case JoinPolicies.Approval:
        return 'Members request to join, you approve';
      case JoinPolicies.InviteOnly:
        return 'Members can only join with an invite';
    }
  }

  get locationLabel(): string {
    return [this.group().city, this.group().country].filter(Boolean).join(', ');
  }

  get recentAvatars(): Array<{ label: string; bg: string; fg: string }> {
    const count = Math.min(4, this.group().memberCount);
    return Array.from({ length: count }, (_, i) => {
      const tone = GroupCard.AV_TONES[i % GroupCard.AV_TONES.length];
      return {
        label: '•',
        bg: `var(--p-${tone}-100)`,
        fg: `var(--p-${tone}-700)`,
      };
    });
  }

  onKebab(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._menu()?.toggle(e);
  }
}
