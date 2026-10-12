import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { SiteHeader } from '../../_shared/components/site-header/site-header';

/** Guest shell of a public profile: the site header with sign-in actions, then the profile. */
@Component({
  selector: 'mh-public-profile-page',
  imports: [RouterOutlet, RouterLink, TranslatePipe, ButtonDirective, SiteHeader],
  templateUrl: './public-profile-page.html',
  styleUrl: './public-profile-page.scss',
})
export class PublicProfilePage {}
