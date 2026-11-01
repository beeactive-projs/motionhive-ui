import {
  Component,
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
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonToggle,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AuthStore,
  GroupService,
  GroupWithMyRole,
  PostApprovalStates,
  PostService,
  WorkoutLog,
  WorkoutLogService,
  appLocale,
  publicProfileUrl,
} from 'core';

import { SettingsRow } from '../../../../_shared/components/settings-row/settings-row';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  HexShape,
  SHARE_HEX_SHAPE,
  hexInset,
  hexShapePath,
  hexSize,
} from '../../../../_shared/config/hexagon.config';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { canPost } from '../../../groups/groups.config';
import {
  CARD_THEMES,
  CardTheme,
  LEGACY_SHARE_PREFS_KEY,
  LOCATION_MAX,
  MOTIONHIVE_TAG,
  RememberedDetail,
  SHARE_ICONS,
  SHARE_ICON_NAMES,
  STICKER_STYLES,
  ShareCardContent,
  ShareDetail,
  ShareDetails,
  ShareMode,
  ShareModes,
  SharePrefs,
  StickerStyle,
  WorkoutKinds,
  cleanPlace,
  hasWeights,
  linkLabel,
  linkParts,
  locationChips,
  parsePlaces,
  parseSharePrefs,
  rememberPlace,
  saveCopyKeys,
  shareCardContent,
  sharePlacesKey,
  sharePrefsKey,
  showFor,
  weekBounds,
  weekOf,
} from '../../_services/share-card.config';
import { ShareCardService } from '../../_services/share-card.service';
import { statsLine } from '../../_services/share-layout.config';
import { injectCopyTag } from '../../_services/share-tag';
import { AdjustDurationSheet } from '../adjust-duration-sheet/adjust-duration-sheet';
import { durationWords } from '../adjust-duration-sheet/adjust-duration.config';
import { ShareGuideSheet } from '../share-guide-sheet/share-guide-sheet';

/** What is running, so one tap does not start a second. */
const BusyStates = {
  Instagram: 'instagram',
  Save: 'save',
  Send: 'send',
  Copy: 'copy',
} as const;
type Busy = (typeof BusyStates)[keyof typeof BusyStates];

/** The preview is drawn small; the actions draw their own full size picture. */
const PREVIEW_SCALE = 0.36;

/** Every switch on, for the lines under the switches: what each one would add. */
const ALL_ON = Object.fromEntries(
  Object.values(ShareDetails).map((detail) => [detail, true]),
) as Record<ShareDetail, boolean>;

/**
 * Share a finished workout (design "Share v3", 2). Rapid at the top is a
 * clean sticker (no logo, handle or link) over the workout's photo or the
 * theme's colours, straight into an Instagram Story; Complet is the card
 * with the logo and the person's link, saved to Photos or sent.
 *
 * Under the live preview: the sticker's style, the four themes, then
 * "What to show" in three groups. Theme, style and switches are kept per
 * person on the phone; naming the coach is chosen each time, and only a
 * coach who allows it can be named. The Duration row's Adjust corrects
 * the workout itself (`mh-adjust-duration-sheet`).
 *
 * This component only wires: what the image says is `share-card.config`,
 * where it goes `share-layout.config`, and the painting `share-card`.
 */
@Component({
  selector: 'mh-share-workout-sheet',
  imports: [
    AdjustDurationSheet,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonToggle,
    SettingsRow,
    ShareGuideSheet,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './share-workout-sheet.html',
  styleUrl: './share-workout-sheet.scss',
})
export class ShareWorkoutSheet {
  private readonly _shareCardService = inject(ShareCardService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);
  private readonly _groupService = inject(GroupService);
  private readonly _postService = inject(PostService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _sheet = viewChild(SheetShell);

  readonly open = model(false);
  readonly log = input.required<WorkoutLog>();
  /** The workout's photo (an object URL), for the Story background and the Full card. */
  readonly photoUrl = input<string | null>(null);
  /** The workout with its corrected duration, so the page behind can say the same. */
  readonly logChange = output<WorkoutLog>();

  readonly Modes = ShareModes;
  readonly Details = ShareDetails;
  readonly icons = SHARE_ICON_NAMES;
  readonly stickers = STICKER_STYLES;
  readonly tag = MOTIONHIVE_TAG;
  readonly locationMax = LOCATION_MAX;
  /** The image clipboard is an iOS idea; the browser build keeps it for testing. */
  readonly canCopySticker = ['ios', 'web'].includes(Capacitor.getPlatform());
  private readonly _saveKeys = saveCopyKeys(Capacitor.getPlatform());

  private readonly _userId = computed(() => this._authStore.user()?.id ?? null);
  readonly prefs = signal<SharePrefs>(parseSharePrefs(null));
  readonly mode = computed(() => this.prefs().mode);
  readonly busy = signal<Busy | null>(null);
  /** Off on every share: naming a coach is chosen each time. */
  readonly coachOn = signal(false);
  readonly location = signal('');
  readonly places = signal<string[]>([]);
  readonly guideOpen = signal(false);
  readonly adjustOpen = signal(false);
  /** The length set through Adjust, until the page behind hands the log back with it. */
  private readonly _duration = signal<number | null>(null);
  /** The workout's week, Monday first, for the Full card's little comb. */
  private readonly _week = signal<boolean[] | null>(null);

  readonly preview = signal<string | null>(null);
  /** The latest draw failed: a line and Retry, not a spinner forever. */
  readonly previewFailed = signal(false);
  /** Bumped by Retry, which the preview effect reads, so it draws again. */
  private readonly _redraw = signal(0);

  /** Your groups that take a post from you; loaded the first time the sheet opens. */
  readonly postableGroups = signal<GroupWithMyRole[] | null>(null);
  /** The group a share is on its way to; one at a time. */
  readonly sharingTo = signal<string | null>(null);

  /** The workout as the images say it: with the corrected length once there is one. */
  readonly workout = computed<WorkoutLog>(() => {
    const duration = this._duration();
    const log = this.log();
    return duration == null ? log : { ...log, durationSeconds: duration };
  });
  readonly hasPhoto = computed(() => !!this.photoUrl());
  readonly hasRecord = computed(() => (this.log().personalRecords?.length ?? 0) > 0);
  readonly rated = computed(() => this.log().feelingRating != null);
  readonly weightsRow = computed(() => hasWeights(this.log()));
  /** A coach's plan at all: the coach row shows, locked when they do not allow it. */
  readonly planCoach = computed(() => this.log().summary?.coachName ?? null);
  readonly mentionableCoach = computed(() => this.log().summary?.mentionableCoach ?? null);
  /** "Bogdan hasn't allowed mentions": the first name says who decided. */
  readonly coachLockedName = computed(() => (this.planCoach() ?? '').split(/\s+/)[0] ?? '');

  private readonly _profileUrl = computed(() => {
    const handle = this._authStore.user()?.handle;
    return handle ? publicProfileUrl(handle) : null;
  });
  /** "app.motionhive.fit" and "@anna", printed with a break point at the slash. */
  readonly profileLink = computed(() => {
    const url = this._profileUrl();
    return url ? linkParts(linkLabel(url)) : null;
  });
  readonly chips = computed(() => locationChips(this._authStore.user()?.city, this.places()));
  /** The Image group has something to switch: a photo, weights, or the Full card's link. */
  readonly imageRows = computed(
    () =>
      this.hasPhoto() ||
      this.weightsRow() ||
      (this.mode() === ShareModes.Full && !!this.profileLink()),
  );

  private readonly _t = (key: string, params?: Record<string, unknown>): string =>
    this._translateService.instant(key, params);

  /** What the image says now. */
  readonly content = computed<ShareCardContent>(() =>
    shareCardContent(
      {
        log: this.workout(),
        show: showFor(this.prefs(), this.mode(), this.coachOn() && !!this.mentionableCoach()),
        location: this.location(),
        profileUrl: this._profileUrl(),
        week: this._week(),
        locale: appLocale(),
      },
      this._t,
    ),
  );

  /** Everything on, for the line under each switch. */
  readonly everything = computed<ShareCardContent>(() =>
    shareCardContent(
      {
        log: this.workout(),
        show: { ...ALL_ON, coach: !!this.mentionableCoach() },
        location: this.location(),
        profileUrl: this._profileUrl(),
        week: null,
        locale: appLocale(),
      },
      this._t,
    ),
  );

  readonly rows = computed(() => {
    const all = this.everything();
    const seconds = this.workout().durationSeconds;
    return {
      duration: seconds ? durationWords(seconds) : this._t('workouts.share.duration.unknown'),
      stats: statsLine(all.stats),
      exercises: all.exercises.length > 0,
      record: all.record ? [all.record.exercise, all.record.best].filter(Boolean).join(' ') : '',
      number: [all.number?.line, all.streak?.line].filter(Boolean).join(' · '),
      feeling: all.feeling?.label ?? '',
      cardio: all.kind === WorkoutKinds.Cardio,
    };
  });

  /** The four themes as hexagons in the brand's shape, each in its own colours. */
  readonly swatches = computed(() => {
    const shape = SHARE_HEX_SHAPE;
    const width = 48;
    const inset = (by: number) => {
      const box = hexInset(shape, 0, 0, width, by);
      return hexShapePath(shape, box.width, 'pointy', box.x, box.y);
    };
    const geometry = {
      viewBox: `-2 -2 ${width + 4} ${hexSize(shape, width).height + 4}`,
      ring: hexShapePath(shape, width),
      face: inset(5),
      dot: inset(17),
    };
    return CARD_THEMES.map((theme) => {
      const palette = this._shareCardService.palette(theme);
      return {
        theme,
        ...geometry,
        stops: palette.surface,
        gradient: palette.surface.length > 1,
        fill: palette.surface.length > 1 ? `url(#mh-swatch-${theme})` : palette.surface[0],
        edge: palette.roles.lines,
        honey: palette.roles.honey,
      };
    });
  });

  readonly subtitle = computed(() =>
    this._t(
      this.mode() === ShareModes.Full
        ? 'workouts.share.mode.fullHint'
        : 'workouts.share.mode.quickHint',
    ),
  );
  readonly saveLabel = computed(() =>
    this._t(
      this.mode() === ShareModes.Full ? this._saveKeys.action : 'workouts.share.instagram.open',
    ),
  );
  readonly actionLabel = computed(() =>
    this.mode() === ShareModes.Full ? this._t('workouts.share.send') : '',
  );
  /**
   * The actions draw their own full size picture, so a preview that failed
   * does not lock them: they try, and say so if that fails too.
   */
  readonly canAct = computed(() => !!this.preview() || this.previewFailed());
  /** The shell's spinner sits on its main button: only for the main action's own work. */
  readonly saving = computed(
    () => this.busy() === BusyStates.Instagram || this.busy() === BusyStates.Save,
  );

  private _photo: { url: string; image: Promise<HTMLImageElement> } | null = null;
  private _draws = 0;

  /** The handle to tag, on the clipboard; written straight from the tap. */
  readonly copyTag = injectCopyTag();

  constructor() {
    addIcons(SHARE_ICONS);

    // Each opening reads this person's choices and places, with the coach off.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const prefs = readPrefs(this._userId());
        this.prefs.set(prefs);
        this.location.set(prefs.location);
        this.places.set(readPlaces(this._userId()));
        this.coachOn.set(false);
        this._loadGroups();
      });
    });

    // The page behind hands the log back with the corrected length.
    effect(() => {
      const log = this.log();
      untracked(() => {
        if (this._duration() === log.durationSeconds) this._duration.set(null);
      });
    });

    // The Full card's week comb, read once the card would show it.
    effect(() => {
      if (!this.open() || this.mode() !== ShareModes.Full || !this.prefs().show.number) return;
      untracked(() => this._loadWeek());
    });

    // The preview redraws as the choices change: the same picture that is
    // sent. Draws can finish out of order; only the latest one is shown.
    effect(() => {
      if (!this.open()) return;
      this._redraw();
      const content = this.content();
      const mode = this.mode();
      const { theme, sticker } = this.prefs();
      const shape = SHARE_HEX_SHAPE;
      const photo = this._usePhoto();
      const draw = ++this._draws;
      this.previewFailed.set(false);
      void this._drawPicture(mode, content, theme, sticker, shape, photo, PREVIEW_SCALE)
        .then((url) => {
          if (draw === this._draws) this.preview.set(url);
        })
        .catch(() => {
          if (draw !== this._draws) return;
          this.preview.set(null);
          this.previewFailed.set(true);
        });
    });
  }

  // ─── Choices ─────────────────────────────────────────────────────────────

  onModeChange(value: unknown): void {
    const mode = [ShareModes.Quick, ShareModes.Full].find((candidate) => candidate === value);
    if (mode) this._update({ mode });
  }

  pickTheme(theme: CardTheme): void {
    this._update({ theme });
  }

  pickSticker(sticker: StickerStyle): void {
    this._update({ sticker });
  }

  /** A remembered switch, or the way's own photo switch. */
  setDetail(detail: RememberedDetail | 'photo', on: boolean): void {
    if (detail === ShareDetails.Photo) {
      this._update(this.mode() === ShareModes.Full ? { fullPhoto: on } : { quickPhoto: on });
      return;
    }
    this._update({ show: { ...this.prefs().show, [detail]: on } });
  }

  /** The switch as it stands for this way (the photo is remembered per way). */
  isOn(detail: RememberedDetail | 'photo'): boolean {
    const prefs = this.prefs();
    if (detail === ShareDetails.Photo) {
      return this.mode() === ShareModes.Full ? prefs.fullPhoto : prefs.quickPhoto;
    }
    return prefs.show[detail];
  }

  /** Typed in the field: kept as the place for next time too. */
  setLocation(value: string | null | undefined): void {
    const place = (value ?? '').slice(0, LOCATION_MAX);
    this.location.set(place);
    this._update({ location: cleanPlace(place) });
  }

  pickPlace(place: string): void {
    this.setLocation(place);
  }

  isPlace(place: string): boolean {
    return cleanPlace(this.location()).toLocaleLowerCase() === place.toLocaleLowerCase();
  }

  /** Draws the preview again after a failure. */
  retryPreview(): void {
    this._redraw.update((count) => count + 1);
  }

  /** The new length from Adjust duration: the images say it now, and the page behind does too. */
  durationSaved(seconds: number): void {
    this._duration.set(seconds);
    this.logChange.emit({ ...this.log(), durationSeconds: seconds });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Rapid: Instagram's Story editor with the sticker on the photo or the
   * theme's colours. Without Instagram the same picture goes to the share
   * sheet, and a note says why; the browser build without Web Share
   * downloads it, and the note says that instead.
   */
  async openInInstagram(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Instagram);
    try {
      const content = this.content();
      const { theme, sticker } = this.prefs();
      const shape = SHARE_HEX_SHAPE;
      const photo = this._usePhoto() ? await this._photoImage() : null;
      const parts = await this._shareCardService.storyParts(content, theme, sticker, shape, photo);
      if ((await this._shareCardService.toInstagramStory(parts)) === 'opened') {
        this._rememberPlace(content);
        this.open.set(false);
        return;
      }
      if (Capacitor.isNativePlatform()) {
        void this._feedbackService.info(this._t('workouts.share.instagram.missing'));
      }
      const image = await this._shareCardService.quickStory(content, theme, sticker, shape, photo);
      const outcome = await this._shareCardService.share(image, this.log().name);
      if (outcome === 'downloaded') {
        void this._feedbackService.info(this._t('workouts.share.instagram.web'));
      }
      if (outcome !== 'cancelled') {
        this._rememberPlace(content);
        this.open.set(false);
      }
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.toast.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * Complet: into Photos (the gallery on Android), then the three steps to
   * post it, unless they are turned off.
   */
  async saveToPhotos(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Save);
    try {
      const content = this.content();
      const outcome = await this._shareCardService.saveToPhotos(await this._fullImage(content));
      if (outcome === 'denied') {
        void this._feedbackService.error(null, this._t(this._saveKeys.denied));
        return;
      }
      this._rememberPlace(content);
      if (this.prefs().guideHidden) {
        this.open.set(false);
        void this._feedbackService.success(this._t(this._saveKeys.done));
        return;
      }
      this.busy.set(null);
      await this._sheet()?.close();
      this.guideOpen.set(true);
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.save.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Complet: the system share sheet, for WhatsApp, Facebook, messages. */
  async send(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Send);
    try {
      const content = this.content();
      const image = await this._fullImage(content);
      const outcome = await this._shareCardService.share(image, this.log().name);
      if (outcome === 'downloaded') {
        void this._feedbackService.success(this._t('workouts.share.downloaded'));
      }
      if (outcome !== 'cancelled') {
        this._rememberPlace(content);
        this.open.set(false);
      }
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.toast.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Complet: only the sticker with the logo and the link, to paste on a Story of their own. */
  async copySticker(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Copy);
    try {
      const image = await this._shareCardService.brandedSticker(
        this.content(),
        this.prefs().theme,
        SHARE_HEX_SHAPE,
      );
      await this._shareCardService.copyImage(image);
      void this._feedbackService.success(this._t('workouts.share.sticker.copied'));
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.sticker.copyFailed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** "Don't show the steps again", from the guide. */
  hideGuide(): void {
    this._update({ guideHidden: true });
  }

  /**
   * Posts the workout into the group as a card. The card is the safe
   * summary, so the group never gets the note, the weights or the photo.
   * A group that reviews member posts holds it until someone approves
   * it, and the toast says so.
   */
  shareToGroup(group: GroupWithMyRole): void {
    if (this.sharingTo()) return;
    this.sharingTo.set(group.id);
    this._postService
      .createPost({ content: '', groupIds: [group.id], workoutLogId: this.log().id })
      .pipe(take(1))
      .subscribe({
        next: ({ posts }) => {
          this.sharingTo.set(null);
          const pending = posts[0]?.approvalState === PostApprovalStates.Pending;
          void this._feedbackService.success(
            this._t(pending ? 'workouts.share.group.pending' : 'workouts.share.group.done', {
              group: group.name,
            }),
          );
          this.open.set(false);
        },
        error: (err) => {
          this.sharingTo.set(null);
          void this._feedbackService.error(err, this._t('workouts.share.group.failed'));
        },
      });
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private _update(change: Partial<SharePrefs>): void {
    this.prefs.update((prefs) => ({ ...prefs, ...change }));
    writeStored(sharePrefsKey(this._userId()), this.prefs());
  }

  /** The way's photo switch, when there is a photo at all. */
  private _usePhoto(): boolean {
    return this.hasPhoto() && this.isOn(ShareDetails.Photo);
  }

  /** A place that went out on an image becomes the first chip next time. */
  private _rememberPlace(content: ShareCardContent): void {
    if (!content.location) return;
    this.places.set(rememberPlace(this.places(), content.location));
    writeStored(sharePlacesKey(this._userId()), this.places());
  }

  private _loadGroups(): void {
    if (this.postableGroups() !== null) return;
    this._groupService
      .getMyGroups()
      .pipe(take(1))
      .subscribe({
        next: (groups) =>
          this.postableGroups.set(groups.filter((group) => canPost(group.myRole, group))),
        error: () => this.postableGroups.set([]),
      });
  }

  /**
   * The days of the workout's week with something done, read quietly: when
   * the read fails the comb shows the workout's own day only.
   */
  private _loadWeek(): void {
    if (this._week() !== null) return;
    const log = this.log();
    this._week.set(weekOf(log.startedAt, []));
    const { from, to } = weekBounds(log.startedAt);
    this._workoutLogService
      .list({ dateFrom: from.toISOString(), dateTo: to.toISOString(), limit: 50 }, { silent: true })
      .pipe(take(1))
      .subscribe({
        next: ({ items }) =>
          this._week.set(
            weekOf(
              log.startedAt,
              items.map((item) => item.startedAt),
            ),
          ),
        error: () => undefined,
      });
  }

  private async _drawPicture(
    mode: ShareMode,
    content: ShareCardContent,
    theme: CardTheme,
    sticker: StickerStyle,
    shape: HexShape,
    usePhoto: boolean,
    scale: number,
  ): Promise<string> {
    const photo = usePhoto ? await this._photoImage() : null;
    return mode === ShareModes.Full
      ? this._shareCardService.fullCard(content, theme, shape, photo, scale)
      : this._shareCardService.quickStory(content, theme, sticker, shape, photo, scale);
  }

  private async _fullImage(content: ShareCardContent): Promise<string> {
    const photo = this._usePhoto() ? await this._photoImage() : null;
    return this._shareCardService.fullCard(
      content,
      this.prefs().theme,
      SHARE_HEX_SHAPE,
      photo,
    );
  }

  /**
   * The photo as an image the canvas can draw. An object URL is same
   * origin, so the card can still be exported once it is drawn on.
   */
  private _photoImage(): Promise<HTMLImageElement | null> {
    const url = this.photoUrl();
    if (!url) return Promise.resolve(null);
    if (this._photo?.url !== url) {
      const image = new Image();
      image.src = url;
      this._photo = { url, image: image.decode().then(() => image) };
    }
    return this._photo.image.catch(() => null);
  }
}

/**
 * This person's choices; before Share v3 they were kept for the phone as a
 * whole, and are read from there once. Private browsing or blocked storage
 * starts from the defaults.
 */
function readPrefs(userId: string | null): SharePrefs {
  try {
    return parseSharePrefs(
      localStorage.getItem(sharePrefsKey(userId)),
      localStorage.getItem(LEGACY_SHARE_PREFS_KEY),
    );
  } catch {
    return parseSharePrefs(null);
  }
}

function readPlaces(userId: string | null): string[] {
  try {
    return parsePlaces(localStorage.getItem(sharePlacesKey(userId)));
  } catch {
    return [];
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered this time; the share itself is unaffected.
  }
}
