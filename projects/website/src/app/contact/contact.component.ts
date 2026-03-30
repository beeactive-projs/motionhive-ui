import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'mh-contact',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule, MessageModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  private readonly _formBuilder = inject(FormBuilder);

  readonly isLoading = signal(false);
  readonly successMessage = signal<string | null>(null);

  readonly contactInfo: { icon: string; label: string; value: string; href?: string }[] = [
    {
      icon: 'pi-map-marker',
      label: 'Address',
      value: '123 MotionHive Street, Tech City, TC 12345',
    },
    {
      icon: 'pi-envelope',
      label: 'Email',
      value: 'info@motionhive.com',
      href: 'mailto:info@motionhive.com',
    },
    {
      icon: 'pi-phone',
      label: 'Phone',
      value: '+1 (234) 567-890',
      href: 'tel:+12345678900',
    },
    {
      icon: 'pi-clock',
      label: 'Business Hours',
      value: 'Mon–Fri: 9:00 AM – 6:00 PM\nWeekends: Closed',
    },
  ];

  readonly contactForm = this._formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.successMessage.set(null);

    setTimeout(() => {
      this.isLoading.set(false);
      this.successMessage.set("Thank you! We'll get back to you within one business day.");
      this.contactForm.reset();
    }, 1500);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.contactForm.get(field);
    return !!(control?.invalid && (control.dirty || control.touched));
  }
}
