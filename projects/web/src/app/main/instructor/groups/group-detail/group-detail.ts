import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  GroupService,
  Group,
  GroupMember,
  JoinPolicy,
  AuthStore,
} from 'core';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info' | 'contrast' | null | undefined;

@Component({
  selector: 'bee-group-detail',
  imports: [
    DatePipe,
    CardModule,
    ButtonModule,
    TagModule,
    TableModule,
    AvatarModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetail implements OnInit {
  private groupService = inject(GroupService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  group = signal<Group | null>(null);
  members = signal<GroupMember[]>([]);
  loading = signal(true);
  membersLoading = signal(true);
  totalMembers = signal(0);
  generatingLink = signal(false);
  joinLink = signal<string | null>(null);

  groupName = computed(() => this.group()?.name ?? 'Group');
  isGroupOwner = computed(() => {
    const group = this.group();
    const user = this.authStore.user();
    return !!group && !!user && group.instructorId === user.id;
  });

  readonly memberRows = 10;

  ngOnInit(): void {
    const groupId = this.route.snapshot.paramMap.get('id');
    if (groupId) {
      this.loadGroup(groupId);
      this.loadMembers(groupId);
    }
  }

  loadGroup(groupId: string): void {
    this.loading.set(true);
    this.groupService.getById(groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load group details',
        });
      },
    });
  }

  loadMembers(groupId: string): void {
    this.membersLoading.set(true);
    this.groupService.getMembers(groupId).subscribe({
      next: (response) => {
        this.members.set(response.items);
        this.totalMembers.set(response.total);
        this.membersLoading.set(false);
      },
      error: () => {
        this.membersLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load group members',
        });
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/app/groups']);
  }

  generateJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this.generatingLink.set(true);
    this.groupService.generateJoinLink(group.id).subscribe({
      next: (response) => {
        this.generatingLink.set(false);
        const link = `${window.location.origin}/app/join/${response.token}`;
        this.joinLink.set(link);
        this.copyToClipboard(link);
        this.messageService.add({
          severity: 'success',
          summary: 'Join Link Generated',
          detail: 'Link has been copied to your clipboard',
        });
      },
      error: () => {
        this.generatingLink.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to generate join link',
        });
      },
    });
  }

  revokeJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this.confirmationService.confirm({
      message: 'Are you sure you want to revoke the current join link? Existing links will stop working.',
      header: 'Revoke Join Link',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.groupService.revokeJoinLink(group.id).subscribe({
          next: () => {
            this.joinLink.set(null);
            this.messageService.add({
              severity: 'success',
              summary: 'Link Revoked',
              detail: 'The join link has been revoked',
            });
            this.loadGroup(group.id);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to revoke join link',
            });
          },
        });
      },
    });
  }

  copyExistingLink(): void {
    const link = this.joinLink();
    if (link) {
      this.copyToClipboard(link);
      this.messageService.add({
        severity: 'info',
        summary: 'Copied',
        detail: 'Join link copied to clipboard',
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Link Unavailable',
        detail: 'Please generate a new join link to copy it.',
      });
    }
  }

  confirmRemoveMember(member: GroupMember): void {
    const name = member.user ? `${member.user.firstName} ${member.user.lastName}` : 'this member';
    this.confirmationService.confirm({
      message: `Are you sure you want to remove ${name} from this group?`,
      header: 'Remove Member',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.removeMember(member),
    });
  }

  private removeMember(member: GroupMember): void {
    const group = this.group();
    if (!group) return;

    this.groupService.removeMember(group.id, member.userId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Member Removed',
          detail: 'Member has been removed from the group',
        });
        this.loadMembers(group.id);
        this.loadGroup(group.id);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to remove member',
        });
      },
    });
  }

  joinPolicySeverity(policy: JoinPolicy): TagSeverity {
    switch (policy) {
      case 'OPEN':
        return 'success';
      case 'APPROVAL':
        return 'warn';
      case 'INVITE_ONLY':
        return 'info';
    }
  }

  joinPolicyLabel(policy: JoinPolicy): string {
    switch (policy) {
      case 'OPEN':
        return 'Open';
      case 'APPROVAL':
        return 'Approval Required';
      case 'INVITE_ONLY':
        return 'Invite Only';
    }
  }

  memberName(member: GroupMember): string {
    if (!member.user) return 'Unknown';
    return `${member.user.firstName} ${member.user.lastName}`;
  }

  memberInitials(member: GroupMember): string {
    if (!member.user) return '??';
    return member.user.firstName.charAt(0) + member.user.lastName.charAt(0);
  }

  hasActiveJoinToken(): boolean {
    const group = this.group();
    if (!group?.joinToken) return false;
    if (!group.joinTokenExpiresAt) return true;
    return new Date(group.joinTokenExpiresAt) > new Date();
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: do nothing, toast already shown
    });
  }

  trackById = (_: number, item: { id: string }) => item.id;
  trackByUserId = (_: number, item: GroupMember) => item.userId;
}
