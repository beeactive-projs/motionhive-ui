import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { UserRole, UserSearchResult, UserService, displayName as personName } from 'core';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Avatar } from '../avatar/avatar';

@Component({
  selector: 'mh-user-search-autocomplete',
  imports: [AutoComplete, IconField, InputIcon, Avatar, TranslatePipe],
  templateUrl: './user-search-autocomplete.html',
})
export class UserSearchAutocomplete {
  private readonly _userService = inject(UserService);

  /** Translated text; empty falls back to the generic "Search by name or email…". */
  readonly placeholder = input<string>('');
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

  /** Also the text the input keeps once a person is picked. */
  readonly displayName = (user: UserSearchResult): string => personName(user);
}
