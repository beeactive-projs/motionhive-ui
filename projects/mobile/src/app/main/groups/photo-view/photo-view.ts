import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { PostService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { GROUP_ICONS } from '../groups.icons';

/**
 * One post's photos, full screen.
 *
 * Its own route rather than a modal so the back gesture closes it and a
 * shared link opens on the right photo. The post is fetched here instead of
 * being passed in for the same reason: this screen has to stand up on its
 * own when it is the first thing opened.
 */
@Component({
  selector: 'mh-photo-view',
  imports: [
    EmptyState,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './photo-view.html',
  styleUrl: './photo-view.scss',
})
export class PhotoView {
  private readonly _postService = inject(PostService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _urls = signal<readonly string[]>([]);
  readonly index = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly current = computed(() => this._urls()[this.index()] ?? '');
  readonly total = computed(() => this._urls().length);
  readonly hasPrevious = computed(() => this.index() > 0);
  readonly hasNext = computed(() => this.index() < this.total() - 1);

  /** "2 of 4" — only worth showing when there is more than one. */
  readonly counter = computed(() =>
    this.total() > 1 ? `${this.index() + 1} of ${this.total()}` : '',
  );

  constructor() {
    addIcons(GROUP_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const postId = params.get('postId');
      if (postId) this._load(postId);
    });

    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const raw = Number(params.get('index'));
        this.index.set(Number.isFinite(raw) && raw > 0 ? raw : 0);
      });
  }

  previous(): void {
    if (this.hasPrevious()) this.index.update((i) => i - 1);
  }

  next(): void {
    if (this.hasNext()) this.index.update((i) => i + 1);
  }

  close(): void {
    // Back rather than a route: this screen is always pushed over the post
    // or the feed it came from, and that is where the reader expects to land.
    void this._router.navigate(['..'], { relativeTo: this._route });
  }

  retry(): void {
    const postId = this._route.snapshot.paramMap.get('postId');
    if (postId) this._load(postId);
  }

  private _load(postId: string): void {
    this.loading.set(true);
    this.error.set(false);

    this._postService
      .getPostById(postId)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (post) => {
          const urls = post.mediaUrls ?? [];
          this._urls.set(urls);
          // A shared link can name an index this post does not have.
          if (this.index() >= urls.length) this.index.set(0);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
