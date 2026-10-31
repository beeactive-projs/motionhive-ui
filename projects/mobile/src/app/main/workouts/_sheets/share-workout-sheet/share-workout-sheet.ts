import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
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
  publicProfileUrl,
} from 'core';

import { HEX_PATH } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../../../_shared/components/settings-row/settings-row';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { copyToClipboard } from '../../../../_shared/utils/share';
import { canPost } from '../../../groups/groups.config';
import {
  CARD_THEMES,
  CardTheme,
  FULL_BACKGROUNDS,
  FullBackground,
  FullBackgrounds,
  MOTIONHIVE_TAG,
  SHARE_ICONS,
  SHARE_ICON_NAMES,
  SHARE_PREFS_KEY,
  STICKER_STYLES,
  ShareCardContent,
  ShareMode,
  ShareModes,
  SharePrefs,
  ShareStep,
  ShareSteps,
  StickerStyle,
  linkLabel,
  openingStep,
  parseSharePrefs,
  saveCopyKeys,
  shareCardContent,
  suggestedMode,
} from '../../_services/share-card.config';
import { ShareCardService } from '../../_services/share-card.service';
import { ShareGuideSheet } from '../share-guide-sheet/share-guide-sheet';

/** The flags each way remembers, by the toggle that changes them. */
type PrefFlag = 'quickKg' | 'quickRecord' | 'quickPhoto' | 'fullKg' | 'fullLink';

/** What is running, so one tap does not start a second. */
const BusyStates = {
  Instagram: 'instagram',
  Save: 'save',
  Send: 'send',
  Copy: 'copy',
} as const;
type Busy = (typeof BusyStates)[keyof typeof BusyStates];

/** The chooser draws its two previews small; the way's own preview a little larger. */
const CHOOSER_SCALE = 0.3;
const PREVIEW_SCALE = 0.45;

/**
 * Share a finished workout, two ways (design "Share Flow", t3).
 *
 * Quick: a clean sticker (no logo, no coach) over the workout's photo or
 * the theme's colours, straight into an Instagram Story through
 * Instagram's own Stories API; the share sheet takes the same picture
 * when Instagram is not there. Full: the card with the logo and the
 * person's link, saved to Photos (then a three step guide) or sent.
 *
 * The first opening asks which way, with a real preview of each; the
 * answer, the theme and the switches are remembered on the device. The
 * coach's name is the exception: it starts off on every share, and only a
 * coach who allows mentions can be named at all.
 *
 * Posting the workout into one of the person's groups stays at the end
 * of either way: it is the only door to it.
 */
@Component({
  selector: 'mh-share-workout-sheet',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonIcon,
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
  private readonly _sheet = viewChild(SheetShell);

  readonly open = model(false);
  readonly log = input.required<WorkoutLog>();
  /** The workout's photo (an object URL), for the Story background and the photo card. */
  readonly photoUrl = input<string | null>(null);

  readonly Steps = ShareSteps;
  readonly Modes = ShareModes;
  readonly Backgrounds = FullBackgrounds;
  readonly icons = SHARE_ICON_NAMES;
  readonly stickers = STICKER_STYLES;
  readonly backgrounds = FULL_BACKGROUNDS;
  readonly tag = MOTIONHIVE_TAG;
  readonly hexPath = HEX_PATH;
  /** The image clipboard is an iOS idea; the browser build keeps it for testing. */
  readonly canCopySticker = ['ios', 'web'].includes(Capacitor.getPlatform());
  private readonly _saveKeys = saveCopyKeys(Capacitor.getPlatform());

  readonly prefs = signal<SharePrefs>(readPrefs());
  readonly step = signal<ShareStep>(ShareSteps.Choose);
  readonly busy = signal<Busy | null>(null);
  /** Off on every share: naming a coach is chosen each time. */
  readonly showCoach = signal(false);
  readonly guideOpen = signal(false);

  readonly quickPreview = signal<string | null>(null);
  readonly fullPreview = signal<string | null>(null);

  /** Your groups that take a post from you; loaded the first time the sheet opens. */
  readonly postableGroups = signal<GroupWithMyRole[] | null>(null);
  /** The group a share is on its way to; one at a time. */
  readonly sharingTo = signal<string | null>(null);

  readonly hasPhoto = computed(() => !!this.photoUrl());
  readonly hasRecord = computed(() => (this.log().personalRecords?.length ?? 0) > 0);
  /** A coach's plan at all: the coach row shows, locked when they do not allow it. */
  readonly planCoach = computed(() => this.log().summary?.coachName ?? null);
  readonly mentionableCoach = computed(() => this.log().summary?.mentionableCoach ?? null);

  private readonly _profileUrl = computed(() => {
    const handle = this._authStore.user()?.handle;
    return handle ? publicProfileUrl(handle) : null;
  });
  /** "app.motionhive.fit/@anna", for the link switch's label. */
  readonly profileLink = computed(() => {
    const url = this._profileUrl();
    return url ? linkLabel(url) : null;
  });

  readonly suggested = computed(() => suggestedMode(this.prefs()));
  /** Each theme's swatch in its own colours, from the same paint the card uses. */
  readonly swatches = computed(() =>
    CARD_THEMES.map((theme) => {
      const palette = this._shareCardService.palette(theme);
      return { theme, fill: palette.card, stroke: palette.border };
    }),
  );
  readonly quickPhoto = computed(() => this.hasPhoto() && this.prefs().quickPhoto);
  readonly fullPhoto = computed(
    () => this.hasPhoto() && this.prefs().fullBackground === FullBackgrounds.Photo,
  );
  readonly background = computed<FullBackground>(() =>
    this.fullPhoto() ? FullBackgrounds.Photo : FullBackgrounds.Hive,
  );

  readonly quickContent = computed(() =>
    shareCardContent(
      this.log(),
      {
        showKg: this.prefs().quickKg,
        showRecord: this.prefs().quickRecord,
        showCoach: false,
        showLink: false,
      },
      this._t,
      null,
    ),
  );

  readonly fullContent = computed(() =>
    shareCardContent(
      this.log(),
      {
        showKg: this.prefs().fullKg,
        showRecord: true,
        showCoach: this.showCoach() && !!this.mentionableCoach(),
        showLink: this.prefs().fullLink,
      },
      this._t,
      this._profileUrl(),
    ),
  );

  readonly title = computed(() =>
    this._t(
      this.step() === ShareSteps.Choose ? 'workouts.share.choose.title' : 'workouts.share.title',
    ),
  );

  readonly subtitle = computed(() => {
    switch (this.step()) {
      case ShareSteps.Quick:
        return this._t('workouts.share.mode.quickHint');
      case ShareSteps.Full:
        return this._t('workouts.share.mode.fullHint');
      default:
        return this._t('workouts.share.choose.subtitle');
    }
  });

  readonly saveLabel = computed(() =>
    this._t(
      this.step() === ShareSteps.Full
        ? this._saveKeys.action
        : 'workouts.share.instagram.open',
    ),
  );
  readonly actionLabel = computed(() =>
    this.step() === ShareSteps.Full ? this._t('workouts.share.send') : '',
  );
  readonly preview = computed(() =>
    this.step() === ShareSteps.Full ? this.fullPreview() : this.quickPreview(),
  );
  /** The shell's spinner sits on its main button: only for the main action's own work. */
  readonly saving = computed(
    () => this.busy() === BusyStates.Instagram || this.busy() === BusyStates.Save,
  );

  private _photo: { url: string; image: Promise<HTMLImageElement> } | null = null;
  private _quickDraws = 0;
  private _fullDraws = 0;

  private readonly _t = (key: string, params?: Record<string, unknown>): string =>
    this._translateService.instant(key, params);

  constructor() {
    addIcons(SHARE_ICONS);

    // Each opening starts from the remembered way, with the coach off.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.step.set(openingStep(this.prefs()));
        this.showCoach.set(false);
        this._loadGroups();
      });
    });

    // The previews redraw as the choices change: the same pictures that are
    // sent. Draws can finish out of order; only the latest one is shown.
    effect(() => {
      if (!this.open() || this.step() === ShareSteps.Full) return;
      const content = this.quickContent();
      const { theme, sticker } = this.prefs();
      const usePhoto = this.quickPhoto();
      const scale = this.step() === ShareSteps.Choose ? CHOOSER_SCALE : PREVIEW_SCALE;
      const draw = ++this._quickDraws;
      void this._drawQuick(content, theme, sticker, usePhoto, scale)
        .then((url) => {
          if (draw === this._quickDraws) this.quickPreview.set(url);
        })
        .catch(() => undefined);
    });
    effect(() => {
      if (!this.open() || this.step() === ShareSteps.Quick) return;
      const content = this.fullContent();
      const theme = this.prefs().theme;
      const usePhoto = this.fullPhoto();
      const scale = this.step() === ShareSteps.Choose ? CHOOSER_SCALE : PREVIEW_SCALE;
      const draw = ++this._fullDraws;
      void this._drawFull(content, theme, usePhoto, scale)
        .then((url) => {
          if (draw === this._fullDraws) this.fullPreview.set(url);
        })
        .catch(() => undefined);
    });
  }

  // ─── Choices ─────────────────────────────────────────────────────────────

  /** Picked in the chooser or on the switch; remembered for next time. */
  pickMode(mode: ShareMode): void {
    this._update({ mode });
    this.step.set(mode);
  }

  onModeChange(value: unknown): void {
    const mode = [ShareModes.Quick, ShareModes.Full].find((candidate) => candidate === value);
    if (mode) this.pickMode(mode);
  }

  pickTheme(theme: CardTheme): void {
    this._update({ theme });
  }

  pickSticker(sticker: StickerStyle): void {
    this._update({ sticker });
  }

  pickBackground(fullBackground: FullBackground): void {
    this._update({ fullBackground });
  }

  setFlag(flag: PrefFlag, on: boolean): void {
    const change: Partial<SharePrefs> = {};
    change[flag] = on;
    this._update(change);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Quick: Instagram's Story editor with the sticker on the photo or the
   * theme's colours. Without Instagram (or in the browser) the same picture
   * goes to the share sheet, and a note says why.
   */
  async openInInstagram(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Instagram);
    try {
      const content = this.quickContent();
      const { theme, sticker } = this.prefs();
      const photo = this.quickPhoto() ? await this._photoImage() : null;
      const parts = await this._shareCardService.storyParts(content, theme, sticker, photo);
      if ((await this._shareCardService.toInstagramStory(parts)) === 'opened') {
        this.open.set(false);
        return;
      }
      void this._feedbackService.info(
        this._t(
          Capacitor.isNativePlatform()
            ? 'workouts.share.instagram.missing'
            : 'workouts.share.instagram.web',
        ),
      );
      const image = await this._shareCardService.quickStory(content, theme, sticker, photo);
      if ((await this._shareCardService.share(image, this.log().name)) === 'shared') {
        this.open.set(false);
      }
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.toast.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Full: into Photos (the gallery on Android), then the three steps to post it (unless they are turned off). */
  async saveToPhotos(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Save);
    try {
      const image = await this._fullImage();
      const outcome = await this._shareCardService.saveToPhotos(image);
      if (outcome === 'denied') {
        void this._feedbackService.error(null, this._t(this._saveKeys.denied));
        return;
      }
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

  /** Full: the system share sheet, for WhatsApp, Facebook, messages. */
  async send(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Send);
    try {
      const image = await this._fullImage();
      if ((await this._shareCardService.share(image, this.log().name)) === 'shared') {
        this.open.set(false);
      }
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.toast.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** Full: only the sticker with the logo, to paste on a Story of their own. */
  async copySticker(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(BusyStates.Copy);
    try {
      const image = await this._shareCardService.brandedSticker(
        this.fullContent(),
        this.prefs().theme,
      );
      await this._shareCardService.copyImage(image);
      void this._feedbackService.success(this._t('workouts.share.sticker.copied'));
    } catch (err) {
      void this._feedbackService.error(err, this._t('workouts.share.sticker.copyFailed'));
    } finally {
      this.busy.set(null);
    }
  }

  /** The handle to tag, on the clipboard; written straight from the tap. */
  async copyTag(): Promise<void> {
    if (await copyToClipboard(MOTIONHIVE_TAG)) {
      void this._feedbackService.success(
        this._t('workouts.share.tag.copied', { tag: MOTIONHIVE_TAG }),
      );
    } else {
      void this._feedbackService.error(
        null,
        this._t('workouts.share.tag.copyFailed', { tag: MOTIONHIVE_TAG }),
      );
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
    writePrefs(this.prefs());
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

  private async _drawQuick(
    content: ShareCardContent,
    theme: CardTheme,
    sticker: StickerStyle,
    usePhoto: boolean,
    scale: number,
  ): Promise<string> {
    const photo = usePhoto ? await this._photoImage() : null;
    return this._shareCardService.quickStory(content, theme, sticker, photo, scale);
  }

  private async _drawFull(
    content: ShareCardContent,
    theme: CardTheme,
    usePhoto: boolean,
    scale: number,
  ): Promise<string> {
    const photo = usePhoto ? await this._photoImage() : null;
    return this._shareCardService.fullCard(content, theme, photo, scale);
  }

  private async _fullImage(): Promise<string> {
    return this._drawFull(this.fullContent(), this.prefs().theme, this.fullPhoto(), 1);
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

/** The remembered choices; private browsing or blocked storage starts from the defaults. */
function readPrefs(): SharePrefs {
  try {
    return parseSharePrefs(localStorage.getItem(SHARE_PREFS_KEY));
  } catch {
    return parseSharePrefs(null);
  }
}

function writePrefs(prefs: SharePrefs): void {
  try {
    localStorage.setItem(SHARE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered this time; the share itself is unaffected.
  }
}
