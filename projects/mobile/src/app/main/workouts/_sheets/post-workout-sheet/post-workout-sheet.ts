import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { barbellOutline, lockClosedOutline } from 'ionicons/icons';
import { Observable, of, switchMap, take } from 'rxjs';

import {
  GroupService,
  GroupWithMyRole,
  GroupsRefreshService,
  PostApprovalStates,
  PostService,
  WorkoutLog,
  appLocale,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SHARE_HEX_SHAPE } from '../../../../_shared/config/hexagon.config';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { POST_MAX_LENGTH, canPost, postNeedsApproval } from '../../../groups/groups.config';
import { ShareCardService } from '../../_services/share-card.service';
import { DEFAULT_SHARE_PREFS, shareCardContent } from '../../_services/share-card.config';
import { durationWords } from '../adjust-duration-sheet/adjust-duration.config';

/** The two ways a workout goes into a group. */
export const PostKinds = {
  /** The person's photo with the workout's details over it, as one picture. */
  Photo: 'photo',
  /** The workout card alone: the safe summary every post can carry. */
  Card: 'card',
} as const;

export type PostKind = (typeof PostKinds)[keyof typeof PostKinds];

/**
 * Posting a finished workout into a group (design 2026-11-14): the photo
 * with the details floating on it, or the workout card; which group, opened
 * in place; a caption; and what the group will see, said before posting.
 *
 * The photo way posts one picture made here, with the share card's sticker
 * drawn on it and the weights always off, so the group never sees a weight
 * or the note. The card way posts the workout card, the summary the API
 * makes from the workout.
 */
@Component({
  selector: 'mh-post-workout-sheet',
  imports: [
    HexAvatar,
    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSkeletonText,
    IonSpinner,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './post-workout-sheet.html',
  styleUrl: './post-workout-sheet.scss',
})
export class PostWorkoutSheet {
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _shareCardService = inject(ShareCardService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly open = model(false);
  readonly log = input.required<WorkoutLog>();
  /** The workout's own photo (an object URL), when it has one. */
  readonly photoUrl = input<string | null>(null);

  readonly posted = output<void>();

  readonly Kinds = PostKinds;
  readonly maxLength = POST_MAX_LENGTH;

  readonly kind = signal<PostKind>(PostKinds.Card);
  readonly groups = signal<GroupWithMyRole[] | null>(null);
  readonly groupId = signal<string | null>(null);
  readonly caption = signal('');
  readonly posting = signal(false);
  /** The picture the photo way will post, drawn when the sheet opens. */
  readonly preview = signal<string | null>(null);

  /** A photo picked here with Change photo, in place of the workout's. */
  private readonly _pickedPhoto = signal<string | null>(null);

  readonly photo = computed(() => this._pickedPhoto() ?? this.photoUrl());
  readonly hasPhoto = computed(() => !!this.photo());

  readonly group = computed(() => {
    const id = this.groupId();
    const list = this.groups() ?? [];
    return list.find((row) => row.id === id) ?? null;
  });

  readonly groupName = computed(() => this.group()?.name ?? '');

  readonly needsApproval = computed(() => {
    const group = this.group();
    return !!group && postNeedsApproval(group.myRole, group);
  });

  /** "Push day · 52 min". */
  readonly subtitle = computed(() => {
    const log = this.log();
    if (!log.durationSeconds) {
      return log.name;
    }
    return `${log.name} · ${durationWords(log.durationSeconds)}`;
  });

  readonly kindHint = computed(() => {
    if (this.kind() === PostKinds.Photo) {
      return 'workouts.postToGroup.photoHint';
    }
    return 'workouts.postToGroup.cardHint';
  });

  readonly privacyLine = computed(() => {
    if (this.kind() === PostKinds.Photo) {
      return 'workouts.postToGroup.privacyPhoto';
    }
    return 'workouts.postToGroup.privacyCard';
  });

  readonly saveLabel = computed(() => {
    const name = this.groupName();
    if (!name) {
      return this._translateService.instant('groups.compose.submit');
    }
    return this._translateService.instant('workouts.postToGroup.submit', { group: name });
  });

  readonly canPost = computed(() => {
    if (this.posting() || !this.group()) {
      return false;
    }
    if (this.caption().length > POST_MAX_LENGTH) {
      return false;
    }
    if (this.kind() === PostKinds.Photo) {
      return !!this.preview();
    }
    return true;
  });

  constructor() {
    addIcons({ barbellOutline, lockClosedOutline });
    // A photo picked here outlives nothing: its object URL goes with the sheet.
    this._destroyRef.onDestroy(() => this._dropPickedPhoto());
    // The workout's photo can arrive after the sheet opened (it streams
    // from private storage): draw the picture whenever the photo changes.
    effect(() => {
      const url = this.photo();
      if (!this.open()) {
        return;
      }
      untracked(() => {
        if (url) {
          this._drawPreview();
        }
      });
    });
  }

  /** Opens on a group (the one tapped on the share sheet), or the first that takes posts. */
  show(groupId: string | null = null): void {
    this.caption.set('');
    this.kind.set(this.hasPhoto() ? PostKinds.Photo : PostKinds.Card);
    this.open.set(true);
    this._loadGroups(groupId);
  }

  setKind(kind: PostKind): void {
    this.kind.set(kind);
  }

  setGroup(groupId: string): void {
    this.groupId.set(groupId);
  }

  changePhoto(): void {
    const input = this._fileInput();
    if (input) {
      input.nativeElement.click();
    }
  }

  onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this._dropPickedPhoto();
    this._pickedPhoto.set(URL.createObjectURL(file));
    this.kind.set(PostKinds.Photo);
  }

  post(): void {
    const group = this.group();
    if (!group || !this.canPost()) {
      return;
    }
    this.posting.set(true);
    const content = this.caption().trim();
    let upload: Observable<string[]> = of([]);
    if (this.kind() === PostKinds.Photo) {
      upload = this._uploadPreview();
    }
    upload
      .pipe(
        switchMap((mediaUrls) => {
          if (mediaUrls.length > 0) {
            return this._postService.createPost({ content, groupIds: [group.id], mediaUrls });
          }
          return this._postService.createPost({
            content,
            groupIds: [group.id],
            workoutLogId: this.log().id,
          });
        }),
        take(1),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: ({ posts }) => {
          this.posting.set(false);
          this.open.set(false);
          this._groupsRefresh.notify();
          let key = 'workouts.share.group.done';
          if (posts[0]?.approvalState === PostApprovalStates.Pending) {
            key = 'workouts.share.group.pending';
          }
          void this._feedbackService.success(
            this._translateService.instant(key, { group: group.name }),
          );
          this.posted.emit();
        },
        error: (error: unknown) => {
          this.posting.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('workouts.share.group.failed'),
          );
        },
      });
  }

  /** The picture as a file the post upload takes. */
  private _uploadPreview(): Observable<string[]> {
    const src = this.preview();
    if (!src) {
      return of([]);
    }
    return of(src).pipe(
      switchMap(async (dataUrl) => {
        const blob = await (await fetch(dataUrl)).blob();
        return new File([blob], 'workout.jpg', { type: blob.type || 'image/jpeg' });
      }),
      switchMap((file) => this._postService.uploadImage(file)),
      switchMap((result) => of([result.url])),
    );
  }

  /**
   * The share card's sticker on the photo, with the weights and the link
   * switched off whatever the person's share settings say.
   */
  private _drawPreview(): void {
    this.preview.set(null);
    const url = this.photo();
    if (!url) {
      return;
    }
    const content = shareCardContent(
      {
        log: this.log(),
        show: {
          ...DEFAULT_SHARE_PREFS.show,
          weights: false,
          link: false,
          location: false,
          coach: false,
          photo: true,
        },
        location: '',
        profileUrl: null,
        week: null,
        locale: appLocale(),
      },
      (key, params) => this._translateService.instant(key, params),
    );
    const image = new Image();
    image.src = url;
    void image
      .decode()
      .then(() =>
        this._shareCardService.quickStory(
          content,
          DEFAULT_SHARE_PREFS.theme,
          DEFAULT_SHARE_PREFS.sticker,
          SHARE_HEX_SHAPE,
          image,
        ),
      )
      .then((dataUrl) => {
        if (this.photo() === url) {
          this.preview.set(dataUrl);
        }
      })
      .catch(() => {
        // A photo that cannot be drawn leaves the card way.
        this.kind.set(PostKinds.Card);
      });
  }

  private _loadGroups(preferred: string | null): void {
    this.groups.set(null);
    this._groupService
      .getMyGroups({ silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (groups) => {
          const postable = groups.filter((group) => canPost(group.myRole, group));
          this.groups.set(postable);
          let pick = postable.find((group) => group.id === preferred) ?? null;
          if (!pick && postable.length > 0) {
            pick = postable[0];
          }
          if (pick) {
            this.groupId.set(pick.id);
          } else {
            this.groupId.set(null);
          }
        },
        error: () => this.groups.set([]),
      });
  }

  private _dropPickedPhoto(): void {
    const url = this._pickedPhoto();
    if (url) {
      URL.revokeObjectURL(url);
      this._pickedPhoto.set(null);
    }
  }
}
