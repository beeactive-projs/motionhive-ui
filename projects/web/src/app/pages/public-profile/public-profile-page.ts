import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { Logo } from 'core';
import { ThemeToggleComponent } from '../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-public-profile-page',
  imports: [RouterOutlet, RouterLink, Button, ToolbarModule, Logo, ThemeToggleComponent],
  templateUrl: './public-profile-page.html',
  styleUrl: './public-profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePage {}
