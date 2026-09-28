import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthStore, Group, GroupService, GroupsRefreshService, Hex, showApiError } from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { GroupFormDialog } from './_dialogs/group-form-dialog/group-form-dialog';
import { monogramFromName, paletteFor } from './_utils/group-palette.util';

@Component({
  selector: 'mh-groups-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonDirective,
    SkeletonModule,
    ToastModule,
    GroupFormDialog,
    Hex,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class GroupsLayout implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _translateService = inject(TranslateService);

  readonly isInstructor = this._authStore.isInstructor;

  joinedGroups = signal<Group[]>([]);
  loadingJoined = signal(true);
  showGroupFormDialog = signal(false);

  monogram(group: Group): string {
    return monogramFromName(group.name);
  }

  /** Solid palette fill for the hex badge (gradient isn't valid SVG fill). */
  badgeBg(group: Group): string {
    return `var(--p-${paletteFor(group.id)}-500)`;
  }

  badgeFg(group: Group): string {
    return `var(--p-${paletteFor(group.id)}-50)`;
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
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('groups.toast.yourGroupsLoadFailed'),
          err,
        );
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
