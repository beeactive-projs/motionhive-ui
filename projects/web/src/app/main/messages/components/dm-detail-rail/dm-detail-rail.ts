import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConversationListItem } from 'core';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { displayName, initialsOf } from '../../utils/participant';

/**
 * Right-rail content for a DM. v1 shows the participant snapshot and
 * three quick actions: Mute (toggle), Report (opens dialog), Block
 * (opens confirm dialog). The "Shared" section from the design
 * (`N sessions together · groups in common · photos shared`) is
 * intentionally deferred because none of those queries are wired on
 * the BE.
 */
@Component({
  selector: 'mh-dm-detail-rail',
  standalone: true,
  imports: [HexAvatar],
  templateUrl: './dm-detail-rail.html',
  styleUrl: './dm-detail-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmDetailRail {
  readonly conversation = input.required<ConversationListItem>();

  readonly block = output<void>();
  readonly toggleMute = output<void>();
  readonly report = output<void>();

  protected readonly other = computed(() => this.conversation().otherUser);
  protected readonly muted = computed(() => this.conversation().muted);

  protected readonly name = computed(() => displayName(this.other()));
  protected readonly initials = computed(() => initialsOf(this.other()));
}
