import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Page heading of an auth card: the title in the site's hero type, and the
 * projected line under it (usually a link to the sibling page).
 */
@Component({
  selector: 'mh-auth-header',
  imports: [TranslatePipe],
  templateUrl: './auth-header.html',
  host: { class: 'block mb-8 animate-slide-down' },
})
export class AuthHeader {
  /** Translation key of the page title. */
  readonly title = input.required<string>();
}
