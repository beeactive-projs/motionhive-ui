import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { translate } from './translator';

/** `pageTitle.sessions` — a translation key rather than literal text. */
const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

/**
 * Browser-tab titles in the UI language.
 *
 * A route's `title` holds a key (`title: 'pageTitle.sessions'`, app JSON), and
 * the tab reads "Sessions - MotionHive" through the shared `common.pageTitle`
 * format. A plain-text title is still shown as written, so a route nobody has
 * migrated keeps working. Routes with no title show the bare app name.
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly _title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    if (!title) {
      this._title.setTitle(translate('common.appName'));
      return;
    }
    const page = KEY_PATTERN.test(title) ? translate(title) : title;
    this._title.setTitle(translate('common.pageTitle', { page }));
  }
}
