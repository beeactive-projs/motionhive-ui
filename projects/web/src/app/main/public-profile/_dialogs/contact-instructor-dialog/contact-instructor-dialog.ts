import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import {
  AuthStore,
  LeadFormat,
  LeadGoal,
  LeadLevel,
  type AvatarUser,
  type InstructorLeadPayload,
} from 'core';
import { PhoneInput } from '../../../../_shared/components/phone-input/phone-input';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

interface PillOption<T extends string> {
  label: string;
  value: T;
}

/**
 * Public lead-capture dialog — the only "contact" action on the
 * instructor profile that intentionally skips the signup wall, per the
 * design contract §9. Guests submit a name + email + a few qualifiers
 * and the instructor receives the lead in their inbox.
 *
 * Authed viewers get name + email prefilled from `AuthStore`.
 *
 * Backend endpoint (`POST /profile/instructor-leads`) ships in Phase
 * A2 — until then `onSubmit()` simulates a successful send so the UX
 * is testable end-to-end.
 */
@Component({
  selector: 'mh-contact-instructor-dialog',
  imports: [ReactiveFormsModule, Dialog, Button, InputText, Message, Textarea, Avatar, PhoneInput],
  providers: [MessageService],
  templateUrl: './contact-instructor-dialog.html',
  styleUrl: './contact-instructor-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactInstructorDialog {
  private readonly _fb = inject(FormBuilder);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly instructorUserId = input.required<string>();
  /** Shown in the header. First-name preferred; falls back to full name. */
  readonly instructorName = input<string>('this instructor');
  readonly instructorAvatar = input<AvatarUser | null>(null);

  readonly submitting = signal(false);

  /** First name for the header copy + privacy line. */
  readonly firstName = computed(() => {
    const name = this.instructorName().trim();
    if (!name) return 'them';
    return name.split(/\s+/)[0];
  });

  readonly goals: PillOption<LeadGoal>[] = [
    { label: 'Lose fat', value: LeadGoal.FatLoss },
    { label: 'Build muscle', value: LeadGoal.Muscle },
    { label: 'Mobility', value: LeadGoal.Mobility },
    { label: 'Endurance', value: LeadGoal.Endurance },
    { label: 'Pre / post-natal', value: LeadGoal.PrePostNatal },
    { label: 'Just feel better', value: LeadGoal.FeelBetter },
  ];

  readonly levels: PillOption<LeadLevel>[] = [
    { label: 'Brand new', value: LeadLevel.New },
    { label: 'Casual', value: LeadLevel.Casual },
    { label: 'Consistent', value: LeadLevel.Consistent },
    { label: 'Athlete', value: LeadLevel.Athlete },
  ];

  readonly formats: PillOption<LeadFormat>[] = [
    { label: 'Online', value: LeadFormat.Online },
    { label: 'In-person', value: LeadFormat.InPerson },
    { label: 'Hybrid', value: LeadFormat.Hybrid },
    { label: 'Open to either', value: LeadFormat.Either },
  ];

  readonly form = this._fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    goal: ['' as LeadGoal | '', Validators.required],
    level: ['' as LeadLevel | '', Validators.required],
    format: ['' as LeadFormat | '', Validators.required],
    message: [''],
  });

  constructor() {
    // Prefill name + email from the auth store whenever the dialog opens
    // for an authed user. Guests see empty fields.
    effect(() => {
      if (!this.visible()) return;
      const me = this._authStore.user();
      if (!me) return;
      const fullName = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim();
      this.form.patchValue({
        name: fullName || this.form.controls.name.value,
        email: me.email || this.form.controls.email.value,
      });
    });
  }

  /** Privacy + header sub-copy use the same first-name string. */
  readonly headerSubcopy = computed(
    () => `No account needed — your message lands straight in ${this.firstName()}'s inbox.`,
  );

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    const payload: InstructorLeadPayload = {
      instructorUserId: this.instructorUserId(),
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || undefined,
      goal: raw.goal as LeadGoal,
      level: raw.level as LeadLevel,
      format: raw.format as LeadFormat,
      message: raw.message.trim() || undefined,
      source: 'profile',
    };

    // TODO(Phase A2): swap this stub for a real
    // `ProfileService.submitInstructorLead(payload)` call once
    // `POST /profile/instructor-leads` exists server-side. The shape
    // above already matches the agreed payload.
    void payload;
    setTimeout(() => {
      this.submitting.set(false);
      this._messageService.add({
        severity: 'success',
        summary: 'Message sent',
        detail: `${this.firstName()} will get back to you. We've sent a copy to your email.`,
        life: 4000,
      });
      this.visible.set(false);
      this.form.reset();
    }, 600);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
    this.form.reset();
  }

  invalid(name: 'name' | 'email' | 'goal' | 'level' | 'format'): boolean {
    const c = this.form.controls[name];
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  getFieldError(name: 'name' | 'email' | 'goal' | 'level' | 'format'): string {
    const errors = this.form.controls[name].errors;
    if (!errors) return '';
    if (errors['required']) {
      switch (name) {
        case 'name':
          return 'Your name is required.';
        case 'email':
          return 'Email address is required.';
        case 'goal':
          return 'Pick a goal so the instructor can tailor their reply.';
        case 'level':
          return 'Let them know where you’re starting from.';
        case 'format':
          return 'Pick how you’d like to train.';
      }
    }
    if (errors['email']) return 'Please enter a valid email address.';
    if (errors['minlength']) return 'Please enter your full name.';
    return '';
  }
}
