import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GroupJoinRequest,
  GroupMember,
  GroupMemberRoles,
  GroupService,
  showApiError,
  TagSeverity,
} from 'core';
import { MessageService } from 'primeng/api';
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
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);

  readonly Roles = GroupMemberRoles;

  readonly searchTerm = signal('');

  readonly joinRequests = signal<GroupJoinRequest[]>([]);
  readonly loadingRequests = signal(false);
  readonly busyRequestIds = signal<Set<string>>(new Set());

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
    if (id) {
      this.context.loadMembers(id);
      if (this.context.isOwner()) {
        this.loadJoinRequests();
      }
    }
  }

  loadJoinRequests(): void {
    const id = this.context.group()?.id;
    if (!id) return;
    this.loadingRequests.set(true);
    this._groupService.listJoinRequests(id).subscribe({
      next: (res) => {
        this.joinRequests.set(res.items);
        this.loadingRequests.set(false);
      },
      error: () => {
        this.loadingRequests.set(false);
        // Silent — pending-requests section is optional UX, don't toast
        // every time the page opens.
      },
    });
  }

  approveRequest(request: GroupJoinRequest): void {
    this.decideRequest(request, 'APPROVE');
  }

  rejectRequest(request: GroupJoinRequest): void {
    this.decideRequest(request, 'REJECT');
  }

  isRequestBusy(requestId: string): boolean {
    return this.busyRequestIds().has(requestId);
  }

  private setRequestBusy(requestId: string, busy: boolean): void {
    this.busyRequestIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(requestId);
      else next.delete(requestId);
      return next;
    });
  }

  private decideRequest(
    request: GroupJoinRequest,
    action: 'APPROVE' | 'REJECT',
  ): void {
    const id = this.context.group()?.id;
    if (!id) return;
    if (this.isRequestBusy(request.id)) return;
    this.setRequestBusy(request.id, true);

    this._groupService
      .decideJoinRequest(id, request.id, { action })
      .subscribe({
        next: () => {
          this.setRequestBusy(request.id, false);
          this.joinRequests.update((list) =>
            list.filter((r) => r.id !== request.id),
          );
          if (action === 'APPROVE') {
            // Approved request creates a member — refresh the table.
            this.context.loadMembers(id);
            this.context.loadGroup(id);
            this._messageService.add({
              severity: 'success',
              summary: 'Request approved',
              detail: '',
            });
          } else {
            this._messageService.add({
              severity: 'info',
              summary: 'Request rejected',
              detail: '',
            });
          }
        },
        error: (err) => {
          this.setRequestBusy(request.id, false);
          showApiError(this._messageService, 'Could not update request', '', err);
        },
      });
  }

  requestUserName(request: GroupJoinRequest): string {
    if (!request.user) return 'Unknown user';
    return `${request.user.firstName} ${request.user.lastName}`;
  }

  requestUserInitials(request: GroupJoinRequest): string {
    if (!request.user) return '??';
    return (
      request.user.firstName.charAt(0).toUpperCase() +
      request.user.lastName.charAt(0).toUpperCase()
    );
  }

  trackRequestById = (_: number, r: { id: string }) => r.id;

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
