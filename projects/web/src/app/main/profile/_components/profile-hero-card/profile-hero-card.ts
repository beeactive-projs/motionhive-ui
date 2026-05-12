import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
  ElementRef,
} from '@angular/core';
import {
  AvatarUser,
  MyProfile,
  TagSeverity,
  UserRoles,
  countryNameFromCode,
} from 'core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

/**
 * Facebook-style hero shown at the top of `/profile`. Mirrors the
 * structure of `mh-group-hero` (p-card + .honeycomb-bg decorative
 * backdrop, avatar + title + tag strip + actions).
 *
 * Identity-level state (avatar upload spinner, optimistic preview,
 * which dialog is open) lives on the parent page so the hero CTAs and
 * the existing dialogs share one source of truth.
 */
@Component({
  selector: 'mh-profile-hero-card',
  imports: [Card, Avatar, Button, TagModule, TooltipModule, DatePipe],
  templateUrl: './profile-hero-card.html',
  styleUrl: './profile-hero-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeroCard {
  readonly profile = input.required<MyProfile>();
  /** Override `profile.account.avatarUrl` while an upload is in flight. */
  readonly avatarUrlOverride = input<string | null>(null);
  readonly uploadingAvatar = input<boolean>(false);
  readonly resendingVerification = input<boolean>(false);

  readonly editPersonalInfo = output<void>();
  readonly editHandle = output<void>();
  readonly viewAsPublic = output<void>();
  readonly resendVerification = output<void>();
  readonly avatarSelected = output<File>();

  private readonly _fileInput =
    viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly avatarUrl = computed<string | null>(
    () => this.avatarUrlOverride() ?? this.profile().account.avatarUrl ?? null,
  );

  readonly avatarUser = computed<AvatarUser>(() => {
    const a = this.profile().account;
    return {
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: this.avatarUrl(),
    };
  });

  readonly fullName = computed(() => {
    const a = this.profile().account;
    return `${a.firstName} ${a.lastName}`.trim();
  });

  readonly handle = computed(() => this.profile().account.handle);
  readonly hasHandle = computed(() => !!this.handle());

  readonly memberSince = computed(() => this.profile().account.createdAt);

  /**
   * "Cluj-Napoca, Romania" / "Romania" / null — whichever the user has
   * filled in. Drives the muted intro line under the name.
   */
  readonly locationLabel = computed<string | null>(() => {
    const a = this.profile().account;
    const parts = [a.city, countryNameFromCode(a.countryCode)].filter(
      (x): x is string => !!x,
    );
    return parts.length ? parts.join(', ') : null;
  });

  /**
   * Curated identity pills. Drops USER (every account has it,
   * signalling nothing) and remaps INSTRUCTOR → "Coach" so we don't
   * leak our RBAC names. Surfaces staff roles first.
   */
  readonly displayBadges = computed<
    { label: string; severity: TagSeverity }[]
  >(() => {
    const roles = new Set(this.profile().roles);
    const out: { label: string; severity: TagSeverity }[] = [];

    if (roles.has(UserRoles.SuperAdmin)) {
      out.push({ label: 'Super admin', severity: TagSeverity.Danger });
    } else if (roles.has(UserRoles.Admin)) {
      out.push({ label: 'Admin', severity: TagSeverity.Warn });
    } else if (roles.has(UserRoles.Support)) {
      out.push({ label: 'Support', severity: TagSeverity.Contrast });
    }

    if (roles.has(UserRoles.Writer)) {
      out.push({ label: 'Writer', severity: TagSeverity.Info });
    }
    if (roles.has(UserRoles.Instructor)) {
      out.push({ label: 'Coach', severity: TagSeverity.Info });
    }
    return out;
  });

  openFilePicker(): void {
    this._fileInput()?.nativeElement.click();
  }

  /**
   * Client-side guard: reject anything that isn't an image or that's
   * over 5 MB before we hand the file up to the parent. The parent
   * (which owns the HTTP layer) still surfaces server-side errors via
   * toast, but doing the cheap checks here avoids a wasted round-trip.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) return;
    this.avatarSelected.emit(file);
  }
}
