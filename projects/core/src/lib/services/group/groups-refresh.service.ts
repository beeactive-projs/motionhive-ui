import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GroupsRefreshService {
  private refreshSubject = new Subject<void>();
  readonly refresh$: Observable<void> = this.refreshSubject.asObservable();

  notify(): void {
    this.refreshSubject.next();
  }
}
