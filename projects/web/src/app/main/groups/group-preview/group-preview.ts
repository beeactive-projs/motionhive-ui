import { DatePipe } from '@angular/common';
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
import { ActivatedRoute, Router } from '@angular/router';
import {
  GroupService,
  GroupsRefreshService,
  Hex,
  JoinPolicies,
  PublicGroupProfile,
  TagSeverity,
  joinPolicyLabel,
  joinPolicySeverity,
  showApiError,
} from 'core';
import { MenuItem, MessageService } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AboutTab } from '../group-detail/tabs/about-tab/about-tab';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';

@Component({
  selector: 'mh-group-preview',
  imports: [
    DatePipe,
    Hex,
    HexAvatar,
    BreadcrumbModule,
    Button,
    Card,
    DividerModule,
    Message,
    SkeletonModule,
    TagModule,
    ToastModule,
    TooltipModule,
    AboutTab,
  ],
  providers: [MessageService],
  templateUrl: './group-preview.html',
  styleUrl: './group-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupPreview implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);

  readonly JoinPolicies = JoinPolicies;
  readonly joinPolicyLabel = joinPolicyLabel;
  readonly joinPolicySeverity = joinPolicySeverity;

  readonly profile = signal<PublicGroupProfile | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly joining = signal(false);
  readonly joinRequestPending = signal(false);

  readonly group = computed(() => this.profile()?.group ?? null);
  readonly instructor = computed(() => this.profile()?.instructor ?? null);
  readonly upcomingSessions = computed(() => this.profile()?.upcomingSessions ?? []);

  readonly breadcrumbItems = computed<MenuItem[]>(() => {
    const g = this.group();
    return [{ label: 'Groups', routerLink: '/groups/discover' }, { label: g?.name ?? 'Preview' }];
  });

  readonly avatarLabel = computed(() => {
    const name = this.group()?.name ?? '';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'G';
  });

  readonly memberCountLabel = computed(() => {
    const n = this.group()?.memberCount ?? 0;
    return `${n} ${n === 1 ? 'member' : 'members'}`;
  });

  readonly visibilityLabel = computed(() => 'Public');

  readonly instructorName = computed(() => {
    const i = this.instructor();
    if (!i) return null;
    return i.displayName?.trim() || `${i.firstName} ${i.lastName}`.trim();
  });

  readonly joinPolicyTagLabel = computed<string>(() => {
    const p = this.group()?.joinPolicy;
    return p ? joinPolicyLabel(p) : '';
  });

  readonly joinPolicyTagSeverity = computed<TagSeverity>(() => {
    const p = this.group()?.joinPolicy;
    return p ? joinPolicySeverity(p) : TagSeverity.Secondary;
  });

  readonly joinButtonLabel = computed(() => {
    if (this.joinRequestPending()) return 'Request pending';
    const policy = this.group()?.joinPolicy;
    if (policy === JoinPolicies.Open) return 'Join group';
    if (policy === JoinPolicies.Approval) return 'Request to join';
    return 'Invite only';
  });

  readonly joinButtonIcon = computed(() => {
    if (this.joinRequestPending()) return 'pi pi-clock';
    const policy = this.group()?.joinPolicy;
    if (policy === JoinPolicies.Open) return 'pi pi-plus';
    if (policy === JoinPolicies.Approval) return 'pi pi-send';
    return 'pi pi-lock';
  });

  readonly joinButtonSeverity = computed(() => {
    const policy = this.group()?.joinPolicy;
    if (policy === JoinPolicies.InviteOnly) return 'secondary';
    return 'primary';
  });

  readonly joinButtonDisabled = computed(() => {
    if (this.joinRequestPending()) return true;
    return this.group()?.joinPolicy === JoinPolicies.InviteOnly;
  });

  ngOnInit(): void {
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('id');
      if (!groupId) return;
      this.loadProfile(groupId);
    });
  }

  loadProfile(groupId: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.joinRequestPending.set(false);
    this._groupService.getPublicProfile(groupId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
        if (profile.group.joinPolicy === JoinPolicies.Approval) {
          this._loadMyJoinRequest(groupId);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
          return;
        }
        showApiError(this._messageService, 'Failed to load group', '', err);
      },
    });
  }

  private _loadMyJoinRequest(groupId: string): void {
    this._groupService.getMyJoinRequest(groupId).subscribe({
      next: ({ request }) => {
        this.joinRequestPending.set(request?.status === 'PENDING');
      },
      // Silent: a missing request is the common case; transient errors
      // shouldn't block the page.
      error: () => this.joinRequestPending.set(false),
    });
  }

  onJoin(): void {
    const g = this.group();
    if (!g || this.joining() || this.joinButtonDisabled()) return;
    this.joining.set(true);

    this._groupService.selfJoin(g.id).subscribe({
      next: (result) => {
        this.joining.set(false);
        if (result.status === 'JOINED') {
          this._messageService.add({
            severity: 'success',
            summary: 'Joined',
            detail: `You're now a member of "${g.name}".`,
          });
          this._groupsRefreshService.notify();
          this._router.navigate(['/groups', g.id]);
        } else {
          this.joinRequestPending.set(true);
          this._messageService.add({
            severity: 'info',
            summary: 'Request sent',
            detail: 'The owner will review your request to join.',
          });
        }
      },
      error: (err) => {
        this.joining.set(false);
        showApiError(this._messageService, 'Could not join group', '', err);
      },
    });
  }

  onCancelRequest(): void {
    const g = this.group();
    if (!g || this.joining()) return;
    this.joining.set(true);

    this._groupService.cancelMyJoinRequest(g.id).subscribe({
      next: () => {
        this.joining.set(false);
        this.joinRequestPending.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Request cancelled',
          detail: '',
        });
      },
      error: (err) => {
        this.joining.set(false);
        showApiError(this._messageService, 'Could not cancel request', '', err);
      },
    });
  }

  goBack(): void {
    this._router.navigate(['/groups/discover']);
  }
}
