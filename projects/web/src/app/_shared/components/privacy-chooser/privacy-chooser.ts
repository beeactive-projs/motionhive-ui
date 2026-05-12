import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import {
  ProfilePrivacy,
  ProfilePrivacyIcons,
  ProfilePrivacyLabels,
  ProfilePrivacyOptions,
} from 'core';

/**
 * Tiny lock-icon trigger that opens a 3-option popover (Public /
 * Coaches only / Only me). Used inline next to each privacy-controlled
 * field on `/profile`. When `locked` is true the icon renders without
 * a popover — for fields whose audience is fixed by the system
 * (verification state, role badges, member-since).
 */
@Component({
  selector: 'mh-privacy-chooser',
  imports: [ButtonModule, PopoverModule, TooltipModule],
  templateUrl: './privacy-chooser.html',
  styleUrl: './privacy-chooser.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyChooser {
  readonly level = input.required<ProfilePrivacy>();
  readonly locked = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  /** Optional tooltip override for the locked / disabled variant. */
  readonly lockedTooltip = input<string>(
    'This setting is managed by the system.',
  );

  readonly levelChange = output<ProfilePrivacy>();

  private readonly _popover = viewChild<Popover>('popover');

  readonly options = ProfilePrivacyOptions;
  readonly Labels = ProfilePrivacyLabels;
  readonly Icons = ProfilePrivacyIcons;

  readonly currentIcon = computed(() => this.Icons[this.level()]);
  readonly currentLabel = computed(() => this.Labels[this.level()]);

  toggle(event: Event): void {
    if (this.locked() || this.disabled()) return;
    this._popover()?.toggle(event);
  }

  pick(level: ProfilePrivacy): void {
    this._popover()?.hide();
    if (level !== this.level()) {
      this.levelChange.emit(level);
    }
  }
}
