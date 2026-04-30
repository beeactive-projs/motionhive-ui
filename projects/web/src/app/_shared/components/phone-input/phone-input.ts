import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { STRIPE_CONNECT_COUNTRIES } from 'core';

/**
 * Option shape for the country select. Pre-built once at module load
 * rather than on every change-detection pass so the dropdown doesn't
 * re-compute flags + calling codes.
 */
interface CountryOption {
  code: CountryCode;
  name: string;
  /** Lowercased ISO code for the `fi fi-xx` flag-icons class. */
  flagClass: string;
  /** "+40" — includes the "+" prefix. */
  callingCode: string;
  /** For the filter / aria — e.g. "Romania +40". */
  searchLabel: string;
}

const COUNTRY_OPTIONS: CountryOption[] = STRIPE_CONNECT_COUNTRIES.map((c) => {
  const callingCode = `+${getCountryCallingCode(c.code as CountryCode)}`;
  return {
    code: c.code as CountryCode,
    name: c.name,
    flagClass: `fi fi-${c.code.toLowerCase()}`,
    callingCode,
    searchLabel: `${c.name} ${callingCode}`,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_COUNTRY: CountryCode = 'RO';

/**
 * PhoneInput
 *
 * A compact intl phone input: flag + calling-code dropdown on the left,
 * national number input on the right. Emits the number in **E.164**
 * format (`+40712345678`) via the two-way bound `value` signal. `null`
 * means either empty or invalid — the parent decides whether that's an
 * error based on its own required/optional policy.
 *
 * Design notes:
 *   - Country list is the Stripe-Connect whitelist (consistent with
 *     the rest of the app). Ordered alphabetically by name.
 *   - Formatting while typing uses `AsYouType` for the selected country.
 *   - On every change we try to parse to E.164 and emit — callers get
 *     valid E.164 or `null`, never a half-formatted string.
 *   - Signals throughout; no NgModel on the component itself, just
 *     internal controls.
 */
@Component({
  selector: 'mh-phone-input',
  imports: [FormsModule, Select, InputText],
  templateUrl: './phone-input.html',
  styleUrl: './phone-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneInput {
  /**
   * Two-way bound E.164 value. `null` / empty string = no number.
   * Parents should bind via `[(value)]` or `[value]+(valueChange)`.
   */
  readonly value = model<string | null>(null);
  readonly placeholder = input<string>('Phone number');
  readonly disabled = input<boolean>(false);
  readonly inputId = input<string>('mh-phone-input');

  readonly countries: CountryOption[] = COUNTRY_OPTIONS;

  /** Currently-selected country. Seeds from the initial `value` if it
   *  parses, falls back to DEFAULT_COUNTRY otherwise. */
  readonly country = signal<CountryCode>(DEFAULT_COUNTRY);

  /** Formatted-as-you-type national number string, bound to the input. */
  readonly national = signal<string>('');

  /**
   * True when the user has typed something but it doesn't parse to a
   * valid E.164 number for the selected country. Drives the small
   * "not a valid number" hint under the input; empty input is not
   * "invalid", just empty.
   *
   * Debounced so the red border / error text only fire ~400ms after
   * the last keystroke — otherwise every mid-typing partial number
   * flashes red.
   */
  readonly invalid = signal<boolean>(false);
  private _invalidTimer: ReturnType<typeof setTimeout> | null = null;

  readonly selectedOption = computed<CountryOption>(() => {
    const c = this.country();
    return (
      COUNTRY_OPTIONS.find((o) => o.code === c) ??
      COUNTRY_OPTIONS.find((o) => o.code === DEFAULT_COUNTRY)!
    );
  });

  /**
   * Hydrate from incoming `value`. Runs only when the value changes
   * from the outside (parent patch, initial load). Avoids re-parsing
   * during user typing because `writeLocalAndEmit` updates `value` in
   * lockstep with `national`.
   */
  private _lastEmittedE164: string | null = null;
  private readonly _hydrateEffect = effect(() => {
    const incoming = this.value();
    if (incoming === this._lastEmittedE164) return;

    if (!incoming) {
      this.national.set('');
      return;
    }
    const parsed = parsePhoneNumberFromString(incoming);
    if (parsed && parsed.country) {
      this.country.set(parsed.country);
      this.national.set(parsed.formatNational());
    } else {
      // Unparseable string — keep it in the input so the user sees their
      // data rather than losing it silently.
      this.national.set(incoming);
    }
  });

  onCountryChange(code: CountryCode): void {
    this.country.set(code);
    // Re-format the existing national number in the new country's
    // scheme and re-emit.
    this.writeLocalAndEmit(this.national());
  }

  onNationalInput(raw: string): void {
    this.writeLocalAndEmit(raw);
  }

  private writeLocalAndEmit(raw: string): void {
    const country = this.country();
    // Accept digits, spaces, dashes, parens, leading `+`, dots — the
    // common separators users type or paste. Strip anything else so
    // letters can't sneak in.
    const sanitized = raw.replace(/[^\d+()\-.\s]/g, '');
    // AsYouType gives a progressive format as the user types.
    const formatted = new AsYouType(country).input(sanitized);
    this.national.set(formatted);

    const parsed = parsePhoneNumberFromString(sanitized, country);
    const e164 = parsed?.isValid() ? parsed.number : null;
    const hasDigits = /\d/.test(sanitized);
    const isInvalid = hasDigits && e164 === null;

    // Clear any pending "you typed an invalid number" blip first.
    if (this._invalidTimer) clearTimeout(this._invalidTimer);
    if (!isInvalid) {
      // Empty / currently-valid — hide the error immediately.
      this.invalid.set(false);
    } else {
      // Defer surfacing the error until the user stops typing so the
      // input doesn't flash red on every partial character.
      this._invalidTimer = setTimeout(() => this.invalid.set(true), 400);
    }

    if (e164 !== this._lastEmittedE164) {
      this._lastEmittedE164 = e164;
      this.value.set(e164);
    }
  }
}
