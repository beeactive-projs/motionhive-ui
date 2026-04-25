import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { UserRole, UserSearchResult, UserService } from 'core';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

@Component({
  selector: 'mh-user-search-autocomplete',
  imports: [AutoComplete, IconField, InputIcon],
  templateUrl: './user-search-autocomplete.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSearchAutocomplete {
  private readonly _userService = inject(UserService);

  readonly placeholder = input<string>('Search by name or email…');
  readonly role = input<UserRole | undefined>(undefined);
  readonly excludeConnected = input<boolean>(false);
  readonly limit = input<number>(10);

  readonly selected = output<UserSearchResult>();
  readonly cleared = output<void>();

  readonly suggestions = signal<UserSearchResult[]>([]);
  readonly searching = signal(false);

  private readonly _search$ = new Subject<string>();

  constructor() {
    this._search$
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          const q = query.trim();
          if (q.length < 2) {
            this.searching.set(false);
            return of<UserSearchResult[]>([]);
          }
          this.searching.set(true);
          return this._userService
            .search({
              q,
              role: this.role(),
              excludeConnected: this.excludeConnected(),
              limit: this.limit(),
            })
            .pipe(catchError(() => of<UserSearchResult[]>([])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.searching.set(false);
        this.suggestions.set(results);
      });
  }

  search(event: AutoCompleteCompleteEvent): void {
    this._search$.next(event.query);
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    this.selected.emit(event.value as UserSearchResult);
  }

  onClear(): void {
    this.suggestions.set([]);
    this.cleared.emit();
  }

  displayName(user: UserSearchResult): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email;
  }

  initials(user: UserSearchResult): string {
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    const combined = (first + last).toUpperCase();
    return combined || user.email.charAt(0).toUpperCase();
  }
}
