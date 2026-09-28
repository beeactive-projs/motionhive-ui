import {
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Post, PostService, showApiError } from 'core';

@Component({
  selector: 'mh-post-reaction-bar',
  imports: [ButtonDirective, TranslatePipe],
  templateUrl: './post-reaction-bar.html',
  styleUrl: './post-reaction-bar.scss',
})
export class PostReactionBar {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly post = input.required<Post>();

  // Optimistic local state — rolls back on API error.
  private readonly _localReacted = signal<boolean | null>(null);
  private readonly _localCount = signal<number | null>(null);
  readonly busy = signal(false);

  readonly reacted = computed(
    () => this._localReacted() ?? this.post().myReaction !== null,
  );
  readonly count = computed(
    () => this._localCount() ?? this.post().reactionCount,
  );

  toggle(): void {
    if (this.busy()) return;
    const before = {
      reacted: this.reacted(),
      count: this.count(),
    };
    // Optimistic flip.
    this._localReacted.set(!before.reacted);
    this._localCount.set(
      before.reacted ? Math.max(0, before.count - 1) : before.count + 1,
    );
    this.busy.set(true);

    this._postService.toggleReaction(this.post().id).subscribe({
      next: (res) => {
        this.busy.set(false);
        this._localReacted.set(res.reacted);
        this._localCount.set(res.count);
      },
      error: (err) => {
        // Roll back optimistic update.
        this.busy.set(false);
        this._localReacted.set(before.reacted);
        this._localCount.set(before.count);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.reactionFailed'),
          '',
          err,
        );
      },
    });
  }
}
