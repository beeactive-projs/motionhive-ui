import { Component, effect, inject, model, signal, untracked } from '@angular/core';
import { take } from 'rxjs';

import { ProfileService, normalizeUrl } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SocialLinksFields } from '../../../../_shared/components/social-links-fields/social-links-fields';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

/** The instructor profile's `socialLinks` — coach accounts only. */
@Component({
  selector: 'mh-links-sheet',
  imports: [SheetShell, SocialLinksFields],
  templateUrl: './links-sheet.html',
  styleUrl: './links-sheet.scss',
})
export class LinksSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);

  readonly open = model(false);
  readonly links = signal<Record<string, string>>({});
  readonly saving = signal(false);

  constructor() {
    // Depends on `open()` alone — see the note in `name-sheet`.
    effect(() => {
      if (!this.open()) return;
      const links = untracked(() => this._accountStore.instructorProfile()?.socialLinks);
      this.links.set({ ...(links ?? {}) });
    });
  }

  save(): void {
    const previous = this._accountStore.instructorProfile()?.socialLinks ?? {};
    const next = normalizeLinks(this.links());

    if (sameLinks(previous, next)) {
      this.open.set(false);
      void this._feedbackService.info('No changes');
      return;
    }

    this.saving.set(true);
    this._accountStore.patchInstructor({ socialLinks: next });

    this._profileService
      .updateInstructorProfile({ socialLinks: next })
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this.saving.set(false);
          this._accountStore.patchInstructor(profile);
          this.open.set(false);
          void this._feedbackService.success('Links updated');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchInstructor({ socialLinks: previous });
          void this._feedbackService.error(error, 'Could not update your links.');
        },
      });
  }
}

/**
 * Drop the blanks and coerce the rest to canonical `https://…`. A value that
 * cannot be coerced safely is kept verbatim so the server can reject it with a
 * message, rather than being silently discarded here.
 */
function normalizeLinks(links: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(links)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    result[key] = normalizeUrl(trimmed) ?? trimmed;
  }
  return result;
}

function sameLinks(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? '') !== (b[key] ?? '')) return false;
  }
  return true;
}
