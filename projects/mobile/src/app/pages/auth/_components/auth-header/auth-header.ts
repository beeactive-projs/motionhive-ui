import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Page heading of an auth screen: the title, and the projected line under it
 * (usually a link to the sibling page). The web app's `mh-auth-header`.
 */
@Component({
  selector: 'mh-auth-header',
  imports: [TranslatePipe],
  templateUrl: './auth-header.html',
  styleUrl: './auth-header.scss',
})
export class AuthHeader {
  /** Translation key of the page title. */
  readonly title = input.required<string>();
}
