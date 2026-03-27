import {
  Component,
  ChangeDetectionStrategy,
  signal,
  ElementRef,
  inject,
  NgZone,
  DestroyRef,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { PublicHeaderComponent } from './header/header.component';
import { PublicFooterComponent } from './footer/footer.component';

@Component({
  selector: 'mh-public-layout',
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // host: {
  //   '[style.--cursor-x]': 'cursorX()',
  //   '[style.--cursor-y]': 'cursorY()',
  // },
})
export class PublicLayoutComponent {
  private readonly _elementRef = inject(ElementRef);
  private readonly _ngZone = inject(NgZone);
  private readonly _destroyRef = inject(DestroyRef);

  // cursorX = signal('50%');
  // cursorY = signal('50%');

  // constructor() {
  //   afterNextRender(() => {
  //     this.zone.runOutsideAngular(() => {
  //       fromEvent<MouseEvent>(this.el.nativeElement, 'mousemove')
  //         .pipe(
  //           throttleTime(30, undefined, { leading: true, trailing: true }),
  //           takeUntilDestroyed(this.destroyRef),
  //         )
  //         .subscribe((e) => {
  //           this.cursorX.set(`${e.clientX}px`);
  //           this.cursorY.set(`${e.clientY}px`);
  //         });
  //     });
  //   });
  // }
}
