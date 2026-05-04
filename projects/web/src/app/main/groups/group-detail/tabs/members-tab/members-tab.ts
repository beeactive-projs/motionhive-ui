import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupMember, GroupMemberRoles, TagSeverity } from 'core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { GroupDetailContext } from '../../group-detail.context';
import { EmptyMembers } from '../../_components/empty-members/empty-members';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-group-members-tab',
  imports: [
    DatePipe,
    FormsModule,
    Avatar,
    Button,
    InputText,
    SkeletonModule,
    TableModule,
    TagModule,
    TooltipModule,
    EmptyMembers,
  ],
  templateUrl: './members-tab.html',
  styleUrl: './members-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersTab implements OnInit {
  readonly context = inject(GroupDetailContext);

  readonly Roles = GroupMemberRoles;

  readonly searchTerm = signal('');

  readonly visibleMembers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.context.members();
    if (!term) return list;
    return list.filter((m) => {
      const name = this.memberName(m).toLowerCase();
      const email = m.user?.email?.toLowerCase() ?? '';
      return name.includes(term) || email.includes(term);
    });
  });

  ngOnInit(): void {
    const id = this.context.group()?.id;
    if (id) this.context.loadMembers(id);
  }

  memberInitials(member: GroupMember): string {
    if (!member.user) return '??';
    return (
      member.user.firstName.charAt(0).toUpperCase() +
      member.user.lastName.charAt(0).toUpperCase()
    );
  }

  memberName(member: GroupMember): string {
    if (!member.user) return 'Unknown';
    return `${member.user.firstName} ${member.user.lastName}`;
  }

  roleLabel(role: GroupMember['role']): string {
    if (role === GroupMemberRoles.Owner) return 'Owner';
    if (role === GroupMemberRoles.Moderator) return 'Moderator';
    return 'Member';
  }

  roleSeverity(role: GroupMember['role']): TagSeverity {
    if (role === GroupMemberRoles.Owner) return TagSeverity.Warn;
    if (role === GroupMemberRoles.Moderator) return TagSeverity.Info;
    return TagSeverity.Secondary;
  }

  onAddMembers(): void {
    this.context.openAddMembersDialog();
  }
}
