import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'mh-loader',
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loader {}
