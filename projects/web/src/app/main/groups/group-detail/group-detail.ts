import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Group } from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { AddMembersDialog } from '../_dialogs/add-members-dialog/add-members-dialog';
import { GroupFormDialog } from '../_dialogs/group-form-dialog/group-form-dialog';
import { GroupHero } from './_components/group-hero/group-hero';
import { GroupTabs } from './_components/group-tabs/group-tabs';
import { GroupDetailContext } from './group-detail.context';

@Component({
  selector: 'mh-group-detail',
  imports: [
    RouterOutlet,
    Button,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    Message,
    AddMembersDialog,
    GroupFormDialog,
    GroupHero,
    GroupTabs,
  ],
  providers: [MessageService, ConfirmationService, GroupDetailContext],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetail implements OnInit {
  readonly context = inject(GroupDetailContext);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  readonly editingGroup = signal<Group | null>(null);
  readonly showEditDialog = signal(false);

  readonly postsCount = computed(() => null);
  readonly membersCount = computed(() => this.context.totalMembers() || null);

  ngOnInit(): void {
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('id');
      if (!groupId) return;
      this.context.loadGroup(groupId);
      this.context.loadMembers(groupId);
      this.context.loadMyGroups();
    });
  }

  goBack(): void {
    this._router.navigate(['/groups']);
  }

  onEditGroup(): void {
    const g = this.context.group();
    if (!g) return;
    this.editingGroup.set(g);
    this.showEditDialog.set(true);
  }

  onGroupSaved(): void {
    this.showEditDialog.set(false);
    this.editingGroup.set(null);
    this.context.refresh();
  }

  onMembersAdded(): void {
    this.context.refresh();
  }
}
