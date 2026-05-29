import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore, Group, GroupService, GroupsRefreshService, showApiError } from 'core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { GroupFormDialog } from './_dialogs/group-form-dialog/group-form-dialog';
import { Avatar } from 'primeng/avatar';
import { monogramFromName, paletteFor } from './_utils/group-palette.util';

@Component({
  selector: 'mh-groups-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    SkeletonModule,
    ToastModule,
    GroupFormDialog,
    Avatar,
  ],
  providers: [MessageService],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsLayout implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly isInstructor = this._authStore.isInstructor;

  joinedGroups = signal<Group[]>([]);
  loadingJoined = signal(true);
  showGroupFormDialog = signal(false);

  monogram(group: Group): string {
    return monogramFromName(group.name);
  }

  avatarStyle(group: Group): Record<string, string> | null {
    if (group.logoUrl) return null;
    const palette = paletteFor(group.id);
    return {
      background: `linear-gradient(155deg, var(--p-${palette}-400), var(--p-${palette}-600))`,
      color: `var(--p-${palette}-50)`,
      fontWeight: '700',
    };
  }

  ngOnInit(): void {
    this.loadJoinedGroups();
    this._groupsRefreshService.refresh$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.loadJoinedGroups());
  }

  loadJoinedGroups(): void {
    this.loadingJoined.set(true);
    this._groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.joinedGroups.set(groups);
        this.loadingJoined.set(false);
      },
      error: (err) => {
        this.loadingJoined.set(false);
        showApiError(this._messageService, 'Error', 'Failed to load your groups', err);
      },
    });
  }

  openCreate(): void {
    this.showGroupFormDialog.set(true);
  }

  onGroupCreated(): void {
    this._groupsRefreshService.notify();
    this._router.navigate(['/groups/your-groups']);
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
